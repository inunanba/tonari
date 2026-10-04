# TONARI / となり

並ぶ時間を、となりの人との小さな共同体験に。

Development checkpoint **0.2**, not a finished submission. The product joins an offline co-op mosaic with an auditable, capacity-aware venue allocation system. This slice adds persisted keys/receipts and a cached offline shell to the signed exchange preview; the allocator and Solana settlement are upcoming work.

## Run this checkpoint

Node24, no npm runtime dependencies:

```sh
npm test
npm run demo
```

Open http://127.0.0.1:4173/apps/web/index.html . Each iframe generates its own non-extractable Ed25519 private key. The page transports public signed messages between clients. This is an explicit **in-page transport**, not working camera QR. Receiving is provisional, not final ownership. Keys and signed receipts are stored in browser-local IndexedDB; clearing site data destroys them. Modern secure-context WebCrypto Ed25519 support is required; unsupported browsers stop visibly.

Browser check (requires Playwright and installed system Chrome, or TONARI_CHROME_PATH): start the server above, then run `node tests/browser-check.cjs`. Alternatively set `TONARI_PLAYWRIGHT` to an installed Playwright package. This checks three different public keys, turns network off after the offline pack is ready, exchanges signed intent, reloads offline, confirms the same keys and receipts and that the third client is unchanged, and captures desktop/mobile screenshots. R0 host browser passed on the earlier public commit. Work's v0.2 browser run remains **HOST_PENDING** because no browser binary is available locally. Also run `node tests/storage-browser.cjs` for real IndexedDB transaction and recovery checks. No v0.2 browser PASS is claimed.

## Proven / pending

- Proven locally: 21 Node tests: real ephemeral Ed25519 signatures, fixed codec, strict schema/domain/show/time, tamper detection, acceptance identity, replay and pair/cooldown reference behavior, concurrent reference receive serialization, immutable verification snapshot, participant and restored-ledger replay policy.
- Implemented but browser unverified: persisted CryptoKeys and receipts, atomic receipt/intent commit, offline app shell and restored three-phone preview.
- Pending: actual v0.2 browser transaction/offline recovery proof, camera QR and Safari fallback, all games, allocator parity, crowd console, Anchor program, relayer, devnet evidence, completion cNFT, verification CLI, videos and forms.

No money, prize, token sale or resale. Completion is intended as a non-transferable keepsake. No venue partnership or real crowd-safety result is claimed. Sensor wording for the eventual product: **sensor-adapter ready, demoed with a simulated feed**. Simulations must be labelled **stylised model, not calibrated**. No public pilot before operational and legal review.

See [protocol](docs/PROTOCOL.md), [architecture and risk decisions](docs/ARCHITECTURE.md), [competitive review](docs/R0_REVIEW.md), [storage checkpoint and measured gaps](docs/R1_STORAGE.md). Public deployment is handled by the assigned operator; this checkpoint makes no chain transaction.
