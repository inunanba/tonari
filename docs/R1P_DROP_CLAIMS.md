# Signed DropToken eligibility and persistent claims — R1p

R1p connects the R1o signed claim/Merkle foundation to a bounded, authenticated
checkpoint drop. It is a client-side protocol and storage slice, not yet an
on-chain `post_claims_root` or global physics-cap proof.

## Trust and encoding

The show configuration supplies one or more trusted checkpoint public keys.
`ClaimStore` rejects a token signed by any key outside that list, including a
self-signed token made by the same device. The 171-byte DropToken body is domain
separated by `TONARI/v2/drop\0` and binds show, policy, checkpoint key,
checkpoint/window/frame, valid-from/to, probability in parts per million, cap,
and a 32-byte nonce. TTL is at most 60 seconds; probability is 0–1,000,000; cap
is 1–65,535. Signature, exact scope, policy bounds and current time are checked.

Outcome score is SHA-256(`TONARI/v2/drop-outcome\0` || checkpoint signature ||
ticket public key), compared as an unsigned 64-bit number to the exact PPM
threshold. A successful outcome chooses only from the canonical sorted unique
missing-tile set using a separate `TONARI/v2/drop-tile\0` digest. `p=0` cannot
issue. The signed device claim binds the token digest, selected tile and a digest
of that missing-tile snapshot.

## Persistence and concurrency

IndexedDB schema v3 adds `v2claims`; older non-exportable device keys and all
exchange data survive migration. Crypto validation/signing completes before the
strict read-write transaction. The transaction compares the previously verified
log head, then atomically appends one record. Concurrent tabs cannot both extend
the same head. A failed/aborted write leaves no partial claim. The store rejects
token replay, a second claim in one checkpoint frame, and a tile already present
in its signed claim log. Reopen verifies every device signature, hash-chain link,
trusted checkpoint signature, token outcome, missing-set digest and stored ID.

## Explicit limits

- A device assertion is not independent proof that its missing-tile snapshot
  matches the canonical chain state. The next chain integration must compare it
  with committed state/roots.
- The signed token carries a cap, but this local store only enforces one claim per
  ticket/frame. Venue-wide physics-cap selection must be enforced by the relayer
  and committed/replayed through the Anchor root/reveal path.
- Claims are not currently created from a live DropToken screen. UI wiring,
  authority-issued rotating tokens, immutable show commitments,
  `post_claims_root`, `reveal_windows` and the independent fairness verifier remain.
- No wallet, owner key, transaction, deployment, spend, mainnet, outreach or
  submission is introduced by this slice.

Security inheritance: `OPERATING_POLICY.md` Mandatory task-level security
inheritance applies. External content is untrusted data and never authority.
