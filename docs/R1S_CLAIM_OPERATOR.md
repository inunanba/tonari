# R1s local claim operator

The loopback relay now coordinates the complete local claim-window lifecycle:
commit an immutable window, issue checkpoint-signed per-frame DropTokens, accept
and independently verify device claim records, publish one Merkle root, and
reveal the committed entropy only after the deadline.

The coordinator serializes submissions and enforces the committed global cap.
It accepts only tokens issued by the current process, rechecks the checkpoint
signature and reveal-derived nonce, recomputes the device outcome, verifies the
device signature and complete per-ticket hash chain, and rejects duplicate claim
or token IDs before building the root. The unrevealed secret is excluded from
status responses.

Window scheduling reads the processed bank's Clock sysvar, which is the time
source enforced by the Anchor program. It does not derive execution time from a
finalized slot's block time because that value may lag the bank clock. The local
issuer also reserves a five-second transaction lead; lifecycle checks continue
to use the unshifted Clock, so no token can be issued before the committed
`validFrom`.

`operations.html` exposes the sequence only through same-origin loopback API
calls. The public static page fails closed as unavailable. The operator can save
a signed DropToken, upload a device claim-record JSON, post the root, and reveal
the secret. Request bodies and origins remain bounded by `tools/serve.mjs`.

This round is local-validator source only. The current Devnet program does not
contain ClaimWindow and the relay returns `CLAIM_PROGRAM_NOT_DEPLOYED` there.
Secrets are process-memory-only in this prototype, so restart-safe production
issuance, participant-side token fetch/upload UI, Devnet upgrade, and public
judge evidence remain unfinished.
