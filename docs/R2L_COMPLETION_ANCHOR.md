# R2l completion anchor

Status: prototype source; not deployed by Work.

R2l adds one immutable Solana PDA per `(show, device)` at seeds `completion / show / device`. The account stores the show policy, device, 32-byte digest of a separately verified completion record, and chain time.

Creation requires both:

1. an immediately preceding native Ed25519 instruction in which the device signs `TONARI/v2/completion-anchor\0 || show || policy || device || record_digest`; and
2. the show authority as transaction signer and payer.

The program rejects CPI, altered instruction data, external precompile references, a paused show, zero device/digest, a wrong show authority, and a second anchor for the same show/device. The client exposes exact message, PDA, instruction and readback helpers.

## Honest capability boundary

This closes only an **on-chain completion-anchor implementation** after validator execution and readback. It is not:

- a compressed NFT or Bubblegum asset;
- a Token-2022 mint;
- a transferable or non-transferable token;
- proof that the referenced portable record is valid unless that record is independently verified;
- deployed or Devnet-proven until Bot returns transaction and account evidence.

The public product must continue to show `cNFT: NOT_VERIFIED` and `nonTransferability: NOT_VERIFIED`. Before Devnet evidence, `onChainAnchor` also remains `NOT_VERIFIED`.

## Host gate

Build and test with the pinned Anchor 0.32.1 / Solana 2.3.0 toolchain, run the local validator path with adversarial precompile/order/account cases, then deploy and exercise on Devnet only through the existing authorized Bot path. Return program/build identity, transaction signature, completion PDA, decoded account, explorer/API readback, and an independent digest match. Do not call the PDA a cNFT.
