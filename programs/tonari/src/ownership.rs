//! v2 ownership transition kernel. No account/sysvar/precompile/validator integration yet.
//! Caller must supply authenticated signed body and authoritative, show-scoped accounts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Offer {
 pub show:[u8;32], pub a:[u8;32], pub b:[u8;32], pub tile_a:[u8;32], pub tile_b:[u8;32], pub nonce:[u8;16],
 pub issued_at:u32, pub expires_at:u32, pub policy:[u8;32], pub version_a:u32, pub version_b:u32, pub settle_by:u32,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reject { Length, Domain, SelfSwap, SameTile, Ttl, Deadline, Reserved, Context, Owner, Version, Overflow, Cap, Cooldown, Replay, Frozen }
fn u32_at(b:&[u8],p:usize)->u32{u32::from_le_bytes(b[p..p+4].try_into().unwrap())}
pub fn decode(b:&[u8])->Result<Offer,Reject>{
 if b.len()!=240{return Err(Reject::Length)}
 if b[..8]!=[84,79,78,65,82,73,0,2]{return Err(Reject::Domain)}
 let o=Offer{show:b[8..40].try_into().unwrap(),a:b[40..72].try_into().unwrap(),b:b[72..104].try_into().unwrap(),tile_a:b[104..136].try_into().unwrap(),tile_b:b[136..168].try_into().unwrap(),nonce:b[168..184].try_into().unwrap(),issued_at:u32_at(b,184),expires_at:u32_at(b,188),policy:b[192..224].try_into().unwrap(),version_a:u32_at(b,224),version_b:u32_at(b,228),settle_by:u32_at(b,232)};
 if o.a==o.b{return Err(Reject::SelfSwap)}if o.tile_a==o.tile_b{return Err(Reject::SameTile)}
 if o.expires_at<=o.issued_at||o.expires_at-o.issued_at>120{return Err(Reject::Ttl)}
 if o.settle_by<o.expires_at||o.settle_by-o.issued_at>604800{return Err(Reject::Deadline)}
 if u32_at(b,236)!=0{return Err(Reject::Reserved)}Ok(o)
}
#[derive(Debug,Clone,PartialEq,Eq)]
pub struct Tile{pub id:[u8;32],pub owner:[u8;32],pub version:u32}
#[derive(Debug,Clone,PartialEq,Eq)]
pub struct Ticket{pub owner:[u8;32],pub count:u32,pub last:Option<u32>,pub frozen:bool}
#[derive(Debug,Clone)]
pub struct Policy{pub show:[u8;32],pub hash:[u8;32],pub deadline:u32,pub cap:u32}
#[derive(Debug,Clone,PartialEq,Eq)]
pub struct Transition{pub tile_a:Tile,pub tile_b:Tile,pub ticket_a:Ticket,pub ticket_b:Ticket}
/// No writes: returns a complete plan only when all checks pass. Pair/nonce PDAs must
/// be validated and created atomically with application; booleans are test-kernel inputs.
pub fn plan(o:&Offer,p:&Policy,a:&Tile,b:&Tile,ta:&Ticket,tb:&Ticket,now:u32,pair_used:bool,nonce_used:bool)->Result<Transition,Reject>{
 if o.show!=p.show||o.policy!=p.hash{return Err(Reject::Context)}
 if now<o.issued_at||now>o.settle_by||now>p.deadline||o.settle_by>p.deadline{return Err(Reject::Deadline)}
 if pair_used||nonce_used{return Err(Reject::Replay)}
 if a.id!=o.tile_a||b.id!=o.tile_b||a.owner!=o.a||b.owner!=o.b||ta.owner!=o.a||tb.owner!=o.b{return Err(Reject::Owner)}
 if a.version!=o.version_a||b.version!=o.version_b{return Err(Reject::Version)}
 if a.version==u32::MAX||b.version==u32::MAX{return Err(Reject::Overflow)}
 if p.cap==0||p.cap>24||ta.count>=p.cap||tb.count>=p.cap{return Err(Reject::Cap)}
 for t in [ta,tb]{if t.frozen{return Err(Reject::Frozen)}if let Some(last)=t.last{if now<last||now-last<120{return Err(Reject::Cooldown)}}}
 Ok(Transition{tile_a:Tile{id:a.id,owner:o.b,version:a.version+1},tile_b:Tile{id:b.id,owner:o.a,version:b.version+1},ticket_a:Ticket{count:ta.count+1,last:Some(now),..ta.clone()},ticket_b:Ticket{count:tb.count+1,last:Some(now),..tb.clone()}})
}
#[cfg(test)]mod tests{
 use super::*;
 fn body()->Vec<u8>{let s=include_str!("../../fixtures/v2-body.hex").trim();(0..s.len()).step_by(2).map(|i|u8::from_str_radix(&s[i..i+2],16).unwrap()).collect()}
 fn fixture()->(Offer,Policy,Tile,Tile,Ticket,Ticket){let o=decode(&body()).unwrap();let p=Policy{show:o.show,hash:o.policy,deadline:o.settle_by,cap:24};let a=Tile{id:o.tile_a,owner:o.a,version:o.version_a};let b=Tile{id:o.tile_b,owner:o.b,version:o.version_b};let ta=Ticket{owner:o.a,count:0,last:None,frozen:false};let tb=Ticket{owner:o.b,..ta.clone()};(o,p,a,b,ta,tb)}
 #[test]fn exact_js_fixture(){let(o,p,a,b,ta,tb)=fixture();assert_eq!(o.version_a,0);assert_eq!(o.version_b,4);let t=plan(&o,&p,&a,&b,&ta,&tb,1200,false,false).unwrap();assert_eq!(t.tile_a.owner,o.b);assert_eq!(t.tile_a.version,1);assert_eq!(t.tile_b.version,5);assert_eq!(a.owner,o.a);}
 #[test]fn malformed_body(){let bytes=body();let body=bytes.as_slice();for n in 0..240{assert_eq!(decode(&body[..n]),Err(Reject::Length))}let mut x=body.to_vec();x.push(0);assert_eq!(decode(&x),Err(Reject::Length));let mut x=body.to_vec();x[7]=1;assert_eq!(decode(&x),Err(Reject::Domain));let mut x=body.to_vec();x[236]=1;assert_eq!(decode(&x),Err(Reject::Reserved));}
 #[test]fn stale_version_and_owner(){let(o,p,mut a,b,ta,tb)=fixture();a.version+=1;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Version));a.version-=1;a.owner=o.b;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Owner));}
 #[test]fn deadline_and_context(){let(o,mut p,a,b,ta,tb)=fixture();for now in [999,o.settle_by+1]{assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,now,false,false),Err(Reject::Deadline))}p.hash[0]^=1;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Context));}
 #[test]fn pair_nonce_replay(){let(o,p,a,b,ta,tb)=fixture();for(pair,nonce)in[(true,false),(false,true)]{assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,pair,nonce),Err(Reject::Replay))}}
 #[test]fn cooldown_boundary(){let(o,p,a,b,mut ta,tb)=fixture();ta.last=Some(1200);assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1319,false,false),Err(Reject::Cooldown));assert!(plan(&o,&p,&a,&b,&ta,&tb,1320,false,false).is_ok());}
 #[test]fn caps_frozen_overflow(){let(mut o,p,mut a,b,mut ta,tb)=fixture();ta.count=24;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Cap));ta.count=0;ta.frozen=true;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Frozen));ta.frozen=false;o.version_a=u32::MAX;a.version=u32::MAX;assert_eq!(plan(&o,&p,&a,&b,&ta,&tb,1200,false,false),Err(Reject::Overflow));}
}
