# R2m anchored completion verifier

Status: source complete; real chain evidence pending.

R2m joins the portable R2k record to the non-token R2l PDA without widening any claim:

1. verify both signatures and every canonical field of the portable 24-piece record;
2. derive its exact completion ID as the 32-byte anchor digest;
3. require the same device to sign the R2l anchor domain over show, policy, device and digest;
4. submit that request through the authority-approved R2l instruction; and
5. independently read the finalized PDA and transaction history with a read-only verifier.

`tools/verify-completion-anchor.mjs` accepts only the official Solana Devnet RPC URL, performs no signing or mutation, requires a finalized successful transaction in the completion PDA's history, reads the account at or after that slot, checks the fixed program owner/discriminator/length, and matches show, policy, device and portable-record digest.

Only after all checks pass does it return `onChainAnchor: VERIFIED`. It always returns:

- `cNFT: NOT_VERIFIED`
- `nonTransferability: NOT_VERIFIED`

The verifier therefore cannot be used to rebrand the PDA as a token or compressed NFT. A missing/unfinalized transaction, unrelated history entry, stale context slot, wrong program account or any field mismatch fails closed.

## Host evidence still required

Bot must first integrate and build R2l with the pinned Cargo/Anchor/Solana toolchain, pass the local validator suite, execute one authorized Devnet anchor, and then run this verifier against the actual portable record and transaction. The returned PDA, transaction, slot, timestamp and record digest must also be independently compared with Explorer/API evidence.
