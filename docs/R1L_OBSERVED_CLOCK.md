# R1l — verified chain time for offline exchange

Bot R1k confirms the Window timer fix in actual Chrome. Node74/native15/
validator22/relay/Chrome5 pass; chain UI now restores both provisional records,
then both settle requests fail SETTLEMENT_EXPIRED_OR_FUTURE. Raw diagnostic
contains no timestamp values, so which time boundary failed remains unproven.

Source inspection identifies a concrete clock inconsistency: relay and program
validate chain time; browser signs absolute Date.now(). Finalized RPC time can
lag device time, and a local validator can drift. Extending settleBy would not
repair an issuedAt in the future. Protocol and native time gates stay unchanged.

New offers use the already verified authority state's observedAt as issuedAt.
The local acceptance timer advances that observation by elapsed device seconds,
using a receivedAt anchor committed atomically with the signed ownership state.
Reload retains that anchor; replaying the same observation does not renew it.
A snapshot older than its 120 second acceptance window requires refresh. Clock
rollback and show deadline exhaustion fail closed. UI reports remaining seconds.
The estimate is local convenience, never chain authorization or independent
chain proof. Actual program Clock still decides settlement validity.

Existing receipts can restore offline even without an older-version clock
anchor. New exchanges require an online verified observation. Device identity
and pending records are preserved; no new database version or wallet is needed.
Service worker v0.7.3 includes the new observed-clock module.

Tests: 78 Node cases pass, including real Ed25519 signatures with a device one
hour fast, reproduction of old future-time failure, delayed chain settlement,
expired authorization rejection, offline age across reload, replay prevention,
forged observation rejection, atomic state/anchor abort. Browser integration
now intentionally offsets Date.now by one hour; it still must reach real local
finalized ownership on both devices with online notification suppressed.
Relay failures log chainNow/issuedAt/expiresAt/settleBy/deadline/wallNow, without
keys or packet data, to distinguish future vs expired if host retest fails.

Work has no current validator/Chrome toolchain. Host retest remains pending.
Bot owns Exact9 PR/green CI and real host tests only. Root/claims/reveal, public
Devnet relay and deployment, final completion experience and submission remain
incomplete. Full NO_GO, score36 unchanged, target100, spend0, no submission.
