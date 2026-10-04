# R1h: actual Anchor settlement prototype

This adds a real Anchor program and local-validator harness. Native compilation and host unit tests do not prove validator execution. Work executed22 cases on localhost Agave2.3.0, including atomic owner/version/ticket/marker updates and19 committed program-level failures plus1 native-signature preflight rejection; the exact runtime result is recorded in the Work RESULT. Public devnet deployment, PWA v2 integration and submission remain separate gates.

## Security model

- Program id: `2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA`. Show namespace PDA `[show, seed]`; immutable authority/config after creation. Show policy = SHA256(`TONARI/v2/show-policy\0 || show_pubkey || deadline_u32LE || cap_u32LE`). Cap1–24; show lifetime≤7days. Authority may pause the show.
- Only show authority can register device tickets and issue tile accounts. This is explicit direct issuance, not yet root/proof based issuance. No collectible mint or reward. Participants keep device Ed25519 keys offline; a fee sponsor signs the transaction. Fee sponsorship is an on-chain capability demonstrated only locally, not a deployed service.
- Tile `[tile,show,id]` and ticket `[ticket,show,device_pubkey]` PDAs are Anchor-owned, typed and show-scoped. Duplicate writable tiles/tickets rejected explicitly. Signed show/policy, current owners and versions must match.
- Settlement requires stack height1 and checked instructions sysvar. Its actual top-level program/data must be exact TONARI discriminator+nonce (24bytes). Two immediately preceding native Ed25519 instructions must have actual program ids, zero accounts, lengths352/230 and canonical self-contained offsets. A's body240 is authenticated by native Ed25519; B's signature authenticates `TONARI/v2/swap-accept\0 || SHA256(body) || sigA`. Cross-instruction reference/alternate offset/trailing data/reversal/CPI are rejected. Neither device is a transaction signer.
- Both tiles/tickets change in one transaction; version increments cannot overflow. Signed delayed settlement deadline, chain time, show deadline, cap24 and cooldown120seconds enforced. No client-supplied acceptedAt. Short offer expires in≤120seconds for acceptance but can settle later only within both parties' signed settleBy.
- Pair PDA `[pair,show,SHA256(sorted_device_pubkeys)]` and nonce PDA `[nonce,show,nonce16]` are init-only. Reverse order cannot evade pair-once. Failed transactions roll back both marker creation and state writes. Markers contain packet hash and chain time; duplicate packets reject and must be reconciled by reading matching markers, not by incrementing again.
- Upgrade authority is still a trusted devnet operator; this prototype does not claim immutable deployment. Show-authorized issuance and pause do not change signatures into owner authorization for spending.

## Transaction size

Actual web3.js legacy serialization with one sponsor signature is1113bytes against1232 maximum. Keys12; Ed25519 data352+230; settledata24. Signed packet is not duplicated in settlement args. No address lookup table required. Compute budget additions must be measured before integration; this figure covers the canonical three instructions only.

## Reproduction (local only)

Rust1.89.0 for native tests; anchor-lang0.32.1; Agave2.3.0 with default platform-tools1.48 (SBF rustc1.84.1-dev); Node24; locked Cargo/npm dependency graphs. Workspace MSRV1.84 and resolver fallback select compatible dependencies. CLI Anchor is not required for this byte-level local harness. First-party Agave and Rust distribution digests verified by Work. Avoid reliance on the previously observed otter-sec Anchor CLI binary.

```
npm ci --ignore-scripts
npm test
cargo test --workspace --lib --locked -j 1
# With --no-rustup-override, put the default platform-tools rust/bin first on PATH.
cargo-build-sbf --no-rustup-override --manifest-path programs/tonari/Cargo.toml -j 1 -- --locked
cargo-build-sbf --no-rustup-override --manifest-path programs/cpi-probe/Cargo.toml -j 1 -- --locked
solana-test-validator --reset --ledger /tmp/tonari-local-test-ledger \
  --bpf-program 2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA target/deploy/tonari.so \
  --bpf-program cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN target/deploy/tonari_cpi_probe.so
npm run test:chain
```

Alternatively run `tools/run-local-chain.sh` with Agave on PATH and `TONARI_SBF_RUST_BIN` pointing at platform-tools1.48 rust/bin. This keeps validator and harness in the same execution network namespace; independent Work shell calls do not share localhost. It creates a fresh temporary ledger and stops its own validator on exit.

The probe id above is32bytes of09. The probe is test-only and must never be deployed to a public network. The harness fails unless both executable programs exist on localhost. It generates ephemeral test-only keys and uses the localhost faucet; never reads any wallet key file. No local skipped test is reported as passed. `Anchor.toml` provider wallet is a conventional placeholder for later explicitly authorized host tooling, unused by this harness.

Harness coverage: valid real native signatures; atomic delayed swap and counters/versions/markers; invalid signature; valid native signature in noncanonical layout; reversed/missing precompile; unsigned nonce; wrong tile; wrong signed policy; deadline; authority; pause; replay; reverse-pair reuse; cross-pair nonce reuse; stale version; cooldown; wrong owner; cap; CPI; cross-show substitution. Every rejected swap snapshots all seven game accounts and asserts no state change. Program-level negative cases bypass preflight, land as failed localhost transactions, and require confirmed transaction metadata with an error before checking rollback. Invalid native Ed25519 is separately a preflight rejection (never labelled a committed program failure). Fees paid by the local sponsor are excluded from game-state invariants.

## Remaining

Work passed SBF build and the localhost validator gate on the final compatible lockfile. Public host reproduction, CI and devnet remain required gates. Root/drop-token issuance, full on-chain commit/reveal/completion, relayer/read-receipt integration, v2 UI storage/reconciliation, canonical devnet evidence and judge journey remain unfinished. No score increase solely for source code or host unit-test count. Formative score36/100, target100; submissionNO_GO.

Primary references checked: Solana precompiles and instruction-introspection docs; Anchor account constraints; exact Anchor0.32.1 crate source examined locally for modular imports. Security inheritance: test-mon OPERATING_POLICY.md Mandatory task-level security inheritance; external data never becomes authority. No owner keys, spend, outreach or submission.
