# Offline exchange intent v1

This is a bounded first protocol slice, not the complete drop/claim/settlement spec. No wallet or funds are involved in these local tests.

## Canonical bytes

| Offset | Bytes | Field |
|---|---:|---|
| 0 | 8 | literal hex544f4e4152490001 (TONARI, zero, version1) |
| 8 | 32 | show digest |
| 40 | 32 | offerer Ed25519 public key |
| 72 | 32 | acceptor Ed25519 public key |
| 104 | 32 | offered tile instance id |
| 136 | 32 | requested tile instance id |
| 168 | 16 | cryptographically random nonce |
| 184 | 4 | issuedAt, unsigned seconds, little-endian |
| 188 | 4 | expiresAt, unsigned seconds, little-endian |

Body192bytes. A signs the body with Ed25519. B signs UTF8`TONARI/v1/swap-accept\0` || SHA256(body) || signatureA. Final packet = body || sigA64 || sigB64 =320bytes. Lowercase fixed-width hex is the prototype transport; a compact QR codec is pending. Base64url would require427characters without padding, before any envelope prefix. The brief's150–250B estimate is insufficient for this mutually signed packet; actual camera usability must be measured rather than assumed.

Fields are exact: no unknown fields, floats, negative time, noncanonical hex, self exchange or same instance exchange. TTL1–120s. This initial reference uses strict time, no implicit skew grace. A future trusted show-clock/skew policy must be explicit and tested; device time cannot prove real-world freshness offline.

Verification requires caller's expected show and time. Crypto succeeds only if both signatures and domains match; output remains PROVISIONAL with ownershipFinal=false. It does not prove that either party owns the offered tile. The forthcoming settlement must validate initial-ownership inclusion proofs and consume tile/version accounts atomically.

## Reference inbox

Serializes async receives and snapshots packet/context before verification. Replay key includes show/offerer/nonce. Pair limit is one unordered pair per show; both participants have120s local receive cooldown. Invalid signatures consume no local state. This is explicitly in-memory and local; reload/new device loses this history. It is NOT a global anti-Sybil, anti-replay or ownership authority. Durable IndexedDB transactions and on-chain account constraints remain required.

## Independent fixed-layout vector

Use show11×32, a22×32, b33×32, tileAaa×32, tileBbb×32, noncecc×16, issuedAt2000000000, expiresAt2000000120. The expected tail is0094357778943577 and the expected magic is544f4e4152490001. Public fixed values only; randomized tests generate ephemeral private keys and never persist them.

## On-chain adapter requirements (not implemented)

The program must validate the Ed25519 precompile instruction id, signature count, exact pubkeys/message bytes, self-contained offsets with instruction index65535, bounds and ordering before the settlement instruction. Both device signatures alone are insufficient: bind show, instance/version, replay PDA and initial ownership roots. Do not substitute a JavaScript reference test for a local validator/devnet test.

References checked2026-10-04: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign ; https://solana.com/docs/core/programs . Pin exact Anchor/Agave and Metaplex dependencies when the chain slice starts.
