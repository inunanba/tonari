# R1i — signed ownership, offline QR and finalized receipt UI

The development route `apps/web/swap.html?client=0` connects the existing v2
368-byte, dual-signed exchange to the actual Anchor settlement instructions.
The v1 exchange route and three-phone prototype remain available for comparison.
Neither route claims that the public Devnet deployment is ready.

## What is persisted

The existing `tonari-v1-phone-{0,1,2}` database upgrades to version 2 without
replacing the nonextractable Ed25519 identity or v1 receipts. Separate v2 stores
hold the configured show, authority-signed ownership snapshots, pending intents,
dual-signed packets and authority-signed finalized receipts. IDB readwrite
transactions serialize competing tabs. Saving a packet clears its matching
intent atomically; an abort preserves both previous records. Pending packets
reserve their tile versions. A second intent cannot silently replace the first.

Every restore re-verifies packet and authority signatures. Offer acceptance is
limited to the signed 120-second expiry; importing an already dual-signed result
does not create a new signature and can occur until the jointly signed
`settleBy`. Historical restore uses the recorded import time to verify those
immutable bytes, never to authorize a new settlement. Cancelling a local intent
cannot revoke signatures already given to another device.

Ownership snapshots bind show, policy, authority, cluster, finalized observation
slot and each tile's owner/version. Older slots, lower versions, missing known
tiles or an owner change at the same version are rejected. Offline snapshots
can become stale; the on-chain version checks remain the final authority.

## Local sponsor and finality boundary

`tools/serve-chain.mjs` creates a fresh local show with three proof-bound device
slots and three real issued tiles per device. `tools/local-relay.mjs` accepts
only HTTP loopback RPC. It generates ephemeral local test keys in memory and
uses the local validator faucet. It reads no wallet files and cannot connect to
Devnet or mainnet. The Node Solana SDK never enters the PWA bundle.

The relay verifies both device signatures before submitting the canonical two
native Ed25519 instructions plus `settle_swap`. Confirmation requires a
successful **finalized** RPC status and both program-owned nonce/pair markers
containing the exact packet hash and the same settlement time. The show
authority signs that observation. The PWA accepts only its configured authority,
show/policy/cluster, exact packet id, and finalized commitment.

This is an **authority attestation of an RPC observation**, not an independent
light-client/SPV proof. A compromised authority/RPC is outside this prototype's
trust guarantee. Local transaction signatures are labelled local and have no
public Explorer link. The frontend currently rejects Devnet configuration.

A lost response after a finalized send is recovered from the nonce and pair
markers plus the exact successful finalized transaction's program ids, account
keys and instruction bytes. Retrying either device returns the same signature,
without applying ownership twice. A relay process restart creates a new test
show; durable sponsor keys and production recovery are not implemented.

The HTTP adapter checks loopback Host and same-origin Origin, JSON media type,
method and a 2 KiB input bound. The service worker caches the new shell and
crypto modules, never API responses. A failed/offline confirmation keeps the
provisional record and retry control. Finalized receipts restore offline.

## Reproduction

```sh
npm ci --ignore-scripts
npm test
# Use the R1h Rust1.89 / Agave2.3 / SBF1.84 toolchain documented in R1H_CHAIN.md.
tools/run-local-chain.sh
# Same launcher additionally tests the actual browser-to-chain path:
TONARI_CHAIN_BROWSER=1 TONARI_PLAYWRIGHT=/path/to/playwright \
  TONARI_CHROME_PATH=/path/to/google-chrome tools/run-local-chain.sh
```

The launcher adds `tests/relay-validator.mjs` after the existing 22 validator
cases. It proves finalized response-loss recovery and exact owner/version
changes against a fresh actual local ledger. The opt-in browser test verifies
offline QR, pending reload, failed confirmation retention, online retry,
identical finalized transaction on both devices, confirmed offline reload and
an unchanged third device. Browser/RPC mocks cannot count as that proof.

Work's current Node suite passes 66 tests, including v1 IDB migration, authority
tampering, rollback, concurrent intents/writes, injected abort and signed receipt
restore. New local relay/browser suites are authored; host execution evidence
must be recorded before claiming their success. This Work workspace lacks the
previous scratch Rust/Agave binaries; Chromium download returned a 195-byte HTML
response rather than an archive. Public integration must preserve Pages'
`npm ci --ignore-scripts` correction and use PR + green CI.

## Remaining before overall GO

Host reproduction and screenshots; an actual reviewed Devnet service/deployment
with durable sponsor/recovery controls; issuance roots/claims; commit-reveal;
games/solo board completion and cNFT keepsake; media/submission package and full
rubric review. The formative score remains 36/100, target 100. Overall submission
is NO-GO. No contest submission, owner keys, real spending or outreach occurs.
