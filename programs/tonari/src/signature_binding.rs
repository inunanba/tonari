//! Strict self-contained Ed25519 precompile-data binding. No cryptographic verification here.
//! Caller MUST validate actual program ID/accounts, checked instructions sysvar,
//! preceding instruction indices and top-level settlement instruction before using this result.
//! Validator executes the native Ed25519 verification; byte matching alone is insufficient.
pub fn matches(data: &[u8], key: &[u8; 32], signature: &[u8; 64], message: &[u8]) -> bool {
    if message.len() > u16::MAX as usize - 112 || data.len() != 112 + message.len() {
        return false;
    }
    if data[0] != 1 || data[1] != 0 { return false; }
    let expected = [48u16, u16::MAX, 16, u16::MAX, 112, message.len() as u16, u16::MAX];
    for (index, value) in expected.iter().enumerate() {
        let p = 2 + 2 * index;
        if u16::from_le_bytes([data[p], data[p + 1]]) != *value { return false; }
    }
    &data[16..48] == key && &data[48..112] == signature && &data[112..] == message
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (Vec<u8>, [u8;32], [u8;64], Vec<u8>) {
        let key=[7u8;32];let sig=[9u8;64];let msg=vec![5u8;192];
        let mut data=vec![0u8;112+msg.len()];data[0]=1;
        for (i,n) in [48u16,u16::MAX,16,u16::MAX,112,msg.len() as u16,u16::MAX].iter().enumerate(){
            data[2+i*2..4+i*2].copy_from_slice(&n.to_le_bytes());
        }
        data[16..48].copy_from_slice(&key);data[48..112].copy_from_slice(&sig);data[112..].copy_from_slice(&msg);
        (data,key,sig,msg)
    }
    #[test] fn exact_binding_only(){let(d,k,s,m)=fixture();assert!(matches(&d,&k,&s,&m));}
    #[test] fn every_mutation_rejected(){let(d,k,s,m)=fixture();for i in 0..d.len(){let mut bad=d.clone();bad[i]^=1;assert!(!matches(&bad,&k,&s,&m),"mutation at {i}");}}
    #[test] fn truncation_and_extension_rejected(){let(d,k,s,m)=fixture();for len in 0..d.len(){assert!(!matches(&d[..len],&k,&s,&m));}let mut bad=d;bad.push(0);assert!(!matches(&bad,&k,&s,&m));}
    #[test] fn wrong_expected_key_sig_message_rejected(){let(d,k,s,m)=fixture();assert!(!matches(&d,&[8;32],&s,&m));assert!(!matches(&d,&k,&[8;64],&m));assert!(!matches(&d,&k,&s,&vec![6;192]));}
    #[test] fn oversized_message_rejected_without_panicking(){assert!(!matches(&[],&[0;32],&[0;64],&vec![0;65535]));}
}
