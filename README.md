# TONARI / となり

並ぶ時間を、となりの人との小さな共同体験に。

Development checkpoint **0.1**, not a finished submission. The product joins an offline co-op mosaic with an auditable, capacity-aware venue allocation system. This first slice implements signed exchange intent and the three-client preview; the allocator and Solana settlement are upcoming work.

## Run this checkpoint

Node24, no npm runtime dependencies:

```sh
npm test
npm run demo
```

Open http://127.0.0.1:4173/apps/web/index.html . Each iframe generates its own non-extractable Ed25519 private key. The page transports public signed messages between clients. This is an explicit **in-page transport**, not working camera QR. Receiving is provisional, not final ownership. The current in-memory state resets on reload. Modern secure-context WebCrypto Ed25519 support is required; unsupported browsers stop visibly.

Browser check (requires Playwright and installed Chromium): start the server above, then run `node tests/browser-check.cjs`. Alternatively set `TONARI_PLAYWRIGHT` to an installed Playwright package. This checks three different public keys, turns network off **after loading**, exchanges signed intent, confirms the third client is unchanged, and captures desktop/mobile screenshots. Work's browser run is **BLOCKED** because Chromium is missing and the installer returned truncated/invalid archive responses. No screenshot or browser PASS is claimed.

## Proven / pending

- Proven locally: 15 Node tests: real ephemeral Ed25519 signatures, fixed codec, strict schema/domain/show/time, tamper detection, acceptance identity, replay and pair/cooldown reference behavior, concurrent receive serialization, immutable verification snapshot.
- Implemented but browser unverified: Japanese three-phone preview with independent key generation and explicit provisional state.
- Pending: IndexedDB crash recovery, service-worker offline pack, camera QR and Safari fallback, all games, allocator parity, crowd console, Anchor program, relayer, devnet evidence, completion cNFT, verification CLI, videos and forms.

No money, prize, token sale or resale. Completion is intended as a non-transferable keepsake. No venue partnership or real crowd-safety result is claimed. Sensor wording for the eventual product: **sensor-adapter ready, demoed with a simulated feed**. Simulations must be labelled **stylised model, not calibrated**. No public pilot before operational and legal review.

See [protocol](docs/PROTOCOL.md), [architecture and risk decisions](docs/ARCHITECTURE.md), [competitive review](docs/R0_REVIEW.md). Public deployment is handled by the assigned operator; this checkpoint makes no chain transaction.
