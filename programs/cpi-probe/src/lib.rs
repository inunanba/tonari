//! Test-only confused-deputy probe. Never deploy to a public network.
use anchor_lang::solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::invoke,
    pubkey::Pubkey,
};
entrypoint!(process);
fn process(_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (program, inner) = accounts
        .split_last()
        .ok_or(anchor_lang::solana_program::program_error::ProgramError::NotEnoughAccountKeys)?;
    let ix = Instruction {
        program_id: *program.key,
        accounts: inner
            .iter()
            .map(|a| AccountMeta {
                pubkey: *a.key,
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            })
            .collect(),
        data: data.to_vec(),
    };
    invoke(&ix, accounts)
}
