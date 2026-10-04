//! Authority-issued prototype. No reward, token transfer, or completion mint.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::get_stack_height,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
};
use solana_sdk_ids::ed25519_program;
use solana_sha256_hasher::hashv;
mod ownership;
mod signature_binding;
declare_id!("2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA");
const ACCEPT: &[u8] = b"TONARI/v2/swap-accept\0";
#[program]
pub mod tonari {
    use super::*;
    pub fn create_show(
        ctx: Context<CreateShow>,
        seed: [u8; 32],
        deadline: u32,
        cap: u32,
    ) -> Result<()> {
        let now = chain_time()?;
        require!(
            deadline > now && u64::from(deadline) <= u64::from(now) + 604800,
            ErrorCode::Deadline
        );
        require!(cap > 0 && cap <= 24, ErrorCode::Cap);
        let key = ctx.accounts.show.key();
        let s = &mut ctx.accounts.show;
        s.seed = seed;
        s.authority = ctx.accounts.authority.key();
        s.deadline = deadline;
        s.cap = cap;
        s.policy = policy_hash(key, deadline, cap);
        s.paused = false;
        s.bump = ctx.bumps.show;
        Ok(())
    }
    pub fn register_ticket(ctx: Context<RegisterTicket>, owner: Pubkey) -> Result<()> {
        require!(owner != Pubkey::default(), ErrorCode::Owner);
        let t = &mut ctx.accounts.ticket;
        t.show = ctx.accounts.show.key();
        t.owner = owner;
        t.count = 0;
        t.last = 0;
        t.has_last = false;
        t.frozen = false;
        t.bump = ctx.bumps.ticket;
        Ok(())
    }
    pub fn issue_tile(ctx: Context<IssueTile>, id: [u8; 32]) -> Result<()> {
        require!(
            !ctx.accounts.show.paused && chain_time()? <= ctx.accounts.show.deadline,
            ErrorCode::Deadline
        );
        let t = &mut ctx.accounts.tile;
        t.show = ctx.accounts.show.key();
        t.id = id;
        t.owner = ctx.accounts.ticket.owner;
        t.version = 0;
        t.bump = ctx.bumps.tile;
        Ok(())
    }
    pub fn pause_show(ctx: Context<PauseShow>, paused: bool) -> Result<()> {
        ctx.accounts.show.paused = paused;
        Ok(())
    }
    pub fn settle_swap(ctx: Context<SettleSwap>, nonce: [u8; 16]) -> Result<()> {
        require!(!ctx.accounts.show.paused, ErrorCode::Paused);
        require!(get_stack_height() == 1, ErrorCode::Cpi);
        let sys = &ctx.accounts.instructions.to_account_info();
        let index = load_current_index_checked(sys)?;
        require!(index >= 2, ErrorCode::Binding);
        let current = load_instruction_at_checked(usize::from(index), sys)?;
        let mut expected = crate::instruction::SettleSwap::DISCRIMINATOR.to_vec();
        expected.extend_from_slice(&nonce);
        require!(
            current.program_id == crate::ID && current.data == expected,
            ErrorCode::Cpi
        );
        let ia = load_instruction_at_checked(usize::from(index) - 2, sys)?;
        let ib = load_instruction_at_checked(usize::from(index) - 1, sys)?;
        require!(
            ia.program_id == ed25519_program::ID
                && ib.program_id == ed25519_program::ID
                && ia.accounts.is_empty()
                && ib.accounts.is_empty(),
            ErrorCode::Binding
        );
        require!(
            ia.data.len() == 352 && ib.data.len() == 230,
            ErrorCode::Binding
        );
        let body = &ia.data[112..];
        let o = ownership::decode(body).map_err(|_| error!(ErrorCode::Body))?;
        require!(o.nonce == nonce, ErrorCode::Binding);
        let sa: [u8; 64] = ia.data[48..112]
            .try_into()
            .map_err(|_| error!(ErrorCode::Binding))?;
        let sb: [u8; 64] = ib.data[48..112]
            .try_into()
            .map_err(|_| error!(ErrorCode::Binding))?;
        let mut accept = Vec::with_capacity(118);
        accept.extend_from_slice(ACCEPT);
        accept.extend_from_slice(hashv(&[body]).as_ref());
        accept.extend_from_slice(&sa);
        require!(
            signature_binding::matches(&ia.data, &o.a, &sa, body)
                && signature_binding::matches(&ib.data, &o.b, &sb, &accept),
            ErrorCode::Binding
        );
        let s = &ctx.accounts.show;
        let a = &ctx.accounts.tile_a;
        let b = &ctx.accounts.tile_b;
        let ta = &ctx.accounts.ticket_a;
        let tb = &ctx.accounts.ticket_b;
        let p = ownership::Policy {
            show: s.key().to_bytes(),
            hash: s.policy,
            deadline: s.deadline,
            cap: s.cap,
        };
        let at = ownership::Tile {
            id: a.id,
            owner: a.owner.to_bytes(),
            version: a.version,
        };
        let bt = ownership::Tile {
            id: b.id,
            owner: b.owner.to_bytes(),
            version: b.version,
        };
        let tat = ownership::Ticket {
            owner: ta.owner.to_bytes(),
            count: ta.count,
            last: ta.has_last.then_some(ta.last),
            frozen: ta.frozen,
        };
        let tbt = ownership::Ticket {
            owner: tb.owner.to_bytes(),
            count: tb.count,
            last: tb.has_last.then_some(tb.last),
            frozen: tb.frozen,
        };
        let now = chain_time()?;
        // Init-only PDA markers enforce replay. Failed transactions roll back init and all changes.
        let next = ownership::plan(&o, &p, &at, &bt, &tat, &tbt, now, false, false).map_err(
            |r| match r {
                ownership::Reject::Owner => error!(ErrorCode::Owner),
                ownership::Reject::Version => error!(ErrorCode::Version),
                ownership::Reject::Cap => error!(ErrorCode::Cap),
                ownership::Reject::Cooldown => error!(ErrorCode::Cooldown),
                ownership::Reject::Deadline => error!(ErrorCode::Deadline),
                _ => error!(ErrorCode::Transition),
            },
        )?;
        let packet_hash = hashv(&[body, &sa, &sb]).to_bytes();
        let show = s.key();
        let tile_a = a.key();
        let tile_b = b.key();
        ctx.accounts.tile_a.owner = Pubkey::new_from_array(next.tile_a.owner);
        ctx.accounts.tile_a.version = next.tile_a.version;
        ctx.accounts.tile_b.owner = Pubkey::new_from_array(next.tile_b.owner);
        ctx.accounts.tile_b.version = next.tile_b.version;
        ctx.accounts.ticket_a.count = next.ticket_a.count;
        ctx.accounts.ticket_a.last = now;
        ctx.accounts.ticket_a.has_last = true;
        ctx.accounts.ticket_b.count = next.ticket_b.count;
        ctx.accounts.ticket_b.last = now;
        ctx.accounts.ticket_b.has_last = true;
        for marker in [
            &mut ctx.accounts.pair_marker,
            &mut ctx.accounts.nonce_marker,
        ] {
            marker.packet_hash = packet_hash;
            marker.settled_at = now;
        }
        emit!(SwapSettled {
            packet_hash,
            show,
            tile_a,
            tile_b,
            settled_at: now
        });
        Ok(())
    }
}
fn chain_time() -> Result<u32> {
    u32::try_from(Clock::get()?.unix_timestamp).map_err(|_| error!(ErrorCode::Deadline))
}
pub fn policy_hash(show: Pubkey, deadline: u32, cap: u32) -> [u8; 32] {
    hashv(&[
        b"TONARI/v2/show-policy\0",
        show.as_ref(),
        &deadline.to_le_bytes(),
        &cap.to_le_bytes(),
    ])
    .to_bytes()
}
pub fn pair_hash(a: Pubkey, b: Pubkey) -> [u8; 32] {
    let (lo, hi) = if a.to_bytes() < b.to_bytes() {
        (a, b)
    } else {
        (b, a)
    };
    hashv(&[lo.as_ref(), hi.as_ref()]).to_bytes()
}
#[derive(Accounts)]
#[instruction(seed:[u8;32])]
pub struct CreateShow<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init,payer=authority,space=8+Show::INIT_SPACE,seeds=[b"show",seed.as_ref()],bump)]
    pub show: Account<'info, Show>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(owner:Pubkey)]
pub struct RegisterTicket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"show",show.seed.as_ref()],bump=show.bump,has_one=authority)]
    pub show: Account<'info, Show>,
    #[account(init,payer=authority,space=8+Ticket::INIT_SPACE,seeds=[b"ticket",show.key().as_ref(),owner.as_ref()],bump)]
    pub ticket: Account<'info, Ticket>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(id:[u8;32])]
pub struct IssueTile<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds=[b"show",show.seed.as_ref()],bump=show.bump,has_one=authority)]
    pub show: Account<'info, Show>,
    #[account(seeds=[b"ticket",show.key().as_ref(),ticket.owner.as_ref()],bump=ticket.bump,has_one=show)]
    pub ticket: Account<'info, Ticket>,
    #[account(init,payer=authority,space=8+Tile::INIT_SPACE,seeds=[b"tile",show.key().as_ref(),id.as_ref()],bump)]
    pub tile: Account<'info, Tile>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct PauseShow<'info> {
    pub authority: Signer<'info>,
    #[account(mut,seeds=[b"show",show.seed.as_ref()],bump=show.bump,has_one=authority)]
    pub show: Account<'info, Show>,
}
#[derive(Accounts)]
#[instruction(nonce:[u8;16])]
pub struct SettleSwap<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds=[b"show",show.seed.as_ref()],bump=show.bump)]
    pub show: Account<'info, Show>,
    #[account(mut,seeds=[b"tile",show.key().as_ref(),tile_a.id.as_ref()],bump=tile_a.bump,has_one=show,constraint=tile_a.key()!=tile_b.key() @ ErrorCode::Alias)]
    pub tile_a: Account<'info, Tile>,
    #[account(mut,seeds=[b"tile",show.key().as_ref(),tile_b.id.as_ref()],bump=tile_b.bump,has_one=show)]
    pub tile_b: Account<'info, Tile>,
    #[account(mut,seeds=[b"ticket",show.key().as_ref(),ticket_a.owner.as_ref()],bump=ticket_a.bump,has_one=show,constraint=ticket_a.key()!=ticket_b.key() @ ErrorCode::Alias)]
    pub ticket_a: Account<'info, Ticket>,
    #[account(mut,seeds=[b"ticket",show.key().as_ref(),ticket_b.owner.as_ref()],bump=ticket_b.bump,has_one=show)]
    pub ticket_b: Account<'info, Ticket>,
    #[account(init,payer=payer,space=8+Marker::INIT_SPACE,seeds=[b"pair",show.key().as_ref(),pair_hash(ticket_a.owner,ticket_b.owner).as_ref()],bump)]
    pub pair_marker: Account<'info, Marker>,
    #[account(init,payer=payer,space=8+Marker::INIT_SPACE,seeds=[b"nonce",show.key().as_ref(),nonce.as_ref()],bump)]
    pub nonce_marker: Account<'info, Marker>,
    /// CHECK: exact address and checked loaders, never unchecked sysvar data.
    #[account(address=anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
#[account]
#[derive(InitSpace)]
pub struct Show {
    pub seed: [u8; 32],
    pub authority: Pubkey,
    pub policy: [u8; 32],
    pub deadline: u32,
    pub cap: u32,
    pub paused: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub show: Pubkey,
    pub owner: Pubkey,
    pub count: u32,
    pub last: u32,
    pub has_last: bool,
    pub frozen: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct Tile {
    pub show: Pubkey,
    pub id: [u8; 32],
    pub owner: Pubkey,
    pub version: u32,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct Marker {
    pub packet_hash: [u8; 32],
    pub settled_at: u32,
}
#[event]
pub struct SwapSettled {
    pub packet_hash: [u8; 32],
    pub show: Pubkey,
    pub tile_a: Pubkey,
    pub tile_b: Pubkey,
    pub settled_at: u32,
}
#[error_code]
pub enum ErrorCode {
    #[msg("Settlement must be top-level")]
    Cpi,
    #[msg("Signature instruction binding rejected")]
    Binding,
    #[msg("Malformed v2 body")]
    Body,
    #[msg("Invalid settlement time")]
    Deadline,
    #[msg("Swap cap exceeded")]
    Cap,
    #[msg("Owner mismatch")]
    Owner,
    #[msg("Ownership version is stale")]
    Version,
    #[msg("Cooldown is active")]
    Cooldown,
    #[msg("Transition rejected")]
    Transition,
    #[msg("Show is paused")]
    Paused,
    #[msg("Duplicate account")]
    Alias,
}
#[cfg(test)]
mod account_tests {
    use super::*;
    #[test]
    fn client_layout_and_policy_match() {
        assert_eq!(8 + Show::INIT_SPACE, 114);
        assert_eq!(8 + Ticket::INIT_SPACE, 83);
        assert_eq!(8 + Tile::INIT_SPACE, 109);
        assert_eq!(8 + Marker::INIT_SPACE, 44);
        assert_eq!(
            policy_hash(Pubkey::new_from_array([9; 32]), 2000, 24),
            [
                0xcc, 0x2a, 0x8f, 0xd4, 0xfc, 0x1c, 0x39, 0x59, 0x6f, 0xfa, 0x31, 0xbb, 0x3c, 0x64,
                0xa3, 0x1b, 0x25, 0xf5, 0x4d, 0x6c, 0xf8, 0x5c, 0x06, 0xea, 0xf3, 0xf2, 0x98, 0x4d,
                0xbc, 0x37, 0x09, 0x3f
            ]
        );
    }
    #[test]
    fn canonical_pair_order() {
        let a = Pubkey::new_from_array([1; 32]);
        let b = Pubkey::new_from_array([2; 32]);
        assert_eq!(pair_hash(a, b), pair_hash(b, a));
        assert_ne!(
            pair_hash(a, b),
            pair_hash(a, Pubkey::new_from_array([3; 32]))
        );
    }
}
