# R2o — live finalized completion

R2o connects the public ownership board to the existing dual-signed portable
completion record and immutable completion PDA. The completion action is shown
only when the current device owns every one of the 24 finalized tile accounts.
It is never inferred from a browser-only game or a locally cached counter.

The local/Devnet relay now performs this sequence:

1. read all 24 tile PDAs at `finalized` and require the same bound device owner;
2. derive domain-separated board and final-state digests from tile IDs and
   versions;
3. return a draft that the device signs;
4. re-read the 24 accounts, reject drafts older than 300 seconds, and reject
   any state change before the show authority co-signs;
5. verify a separately signed completion-anchor request, submit the immutable
   PDA instruction, and read the exact show/policy/device/record digest back at
   `finalized`.

The browser then offers a JSON download containing the portable record and
anchor result. A Devnet transaction link is displayed only for a Devnet
configuration. Localnet remains labelled as local evidence.

`claimsRoot` is currently the all-zero sentinel because this path does not yet
bind a published claim window root. It must not be described as claim/reveal
evidence. The board/final-state digests attest only to the finalized ownership
snapshot from which they were derived.

## Explicit boundary

This completion PDA is **not a cNFT**. The product and returned evidence keep:

- `cNFT: NOT_VERIFIED`
- `nonTransferability: NOT_VERIFIED`

Host tests cannot establish a public deployment or real-browser result. Bot
must overlay the exact Work artifact, run the full host suite and a purpose-built
24/24 local-validator flow (including stale draft, state-change, wrong owner,
replay and readback negatives), then repeat the successful path on authorized
Devnet and return public transaction/account evidence. Submission remains
`NO_GO` until those gates, the residual cNFT decision, media, Work final review,
and owner final approval are complete.
