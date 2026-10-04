# Architecture and claims that must survive testing

## Build order

1. Protocol bytes/tests and independently keyed three-client preview (this checkpoint).
2. Durable phone state and offline pack; QR codec/scanner; two games with pause/quit and no reward pressure. Each client owns its key/storage namespace; the three-phone parent transports public envelopes only. Same-origin iframes are component isolation, not an adversarial security boundary.
3. TypeScript allocator port of canonical Python sim with exported golden vectors. Add stale/future sensor checks, FREEZE, capacity ceilings, governor and availability rather than fake quantitative benefits in the UI.
4. Anchor ownership/state machine, signature introspection, claims roots, reveal and standalone verifier. Build plus local validator negatives precede devnet. Request program public id from the operator, never private keys.
5. Judge story/ops console, real devnet links, completion record, videos/forms and integrated adversarial review. Scope cuts follow the canonical brief; no finished-feature claim based on an untested stub.

Monorepo slots retained: apps/web, packages/protocol, packages/allocator, packages/games, programs/tonari, services/relayer, tools/verify, sim, docs. First slice is standard ESM JavaScript with browser WebCrypto to stay dependency-free; allocator/Anchor follow their required toolchains. Protocol can gain TypeScript declarations without changing canonical bytes.

## Consequential design corrections

| Risk | Decision / proving test |
|---|---|
| Offline signature mistaken for final ownership | Always provisional; only atomic settlement consumes source instance/version. Demonstrate two offline conflicting swaps and exactly one settled owner. |
| First-settled-wins mistaken for proof of an honest person | Submission order proves no moral fault. Require conflicting signed authorizations for the same input/version before any freeze; replacement policy uses a bounded committed pool, never invents assets. Work must implement and test the exact rule. |
| Offline global per-frame cap impossible to coordinate | Phones can verify local intent, not global attendance. Cap enforcement belongs at claim reconciliation/settlement; user shows provisional result. Do not claim strict real-time global cap without a coordinated display/counter. |
| Signed sensor data called provable crowd safety | Signatures authenticate origin; replay verifies computations only. Neither proves physical readings, causal crowd effects or safety. Use “auditable allocation policy”, no “provably safe crowd”. |
| Randomness and time | Chain commit/reveal shows what was committed; future slot hash can be leader-influenced. Fallback explicitly weaker; offline client time is untrusted. Test expired/missing/randomness failure. |
| Cold start with no signal | Offline loop requires the show pack loaded beforehand. Do not promise first-ever visit in airplane mode. Cached reload, storage failure and interrupted writes need tests. |
| Device key = durable record claim | An on-chain record may persist, but losing browser storage can lose control. State recovery limits; no silent cloud secret export. |
| “Only entry” / win percentage | Keyword absence does not prove uniqueness. Use concrete feature comparison, no exclusivity or calibrated win-odds claim. |
| Keepsake/legal | No completion-linked coupon/prize or purchase mechanism; no legal-compliance guarantee. Actual pilot requires review. |
| Simulation extrapolation | Preserve seed/scenario coverage,20stress runs denominator, and calibration limits. Re-run authoritative source before using numerical claims. |
| Browser compatibility | Native Ed25519 failure is visible. Safari/mobile camera tests and audited fallback are acceptance gates. Desktop emulation is not physical-device evidence. |
| Non-transferable cNFT | Verify current Bubblegum support and exact policy in devnet. Freeze is not automatically permanent non-transferability. Label authorized PDA/Token2022 fallback honestly if needed. |

## Acceptance gates

The finishing line is a fresh-browser, wallet-free judge path under3minutes, two games, 24tile board, genuine offline exchange, allocator golden parity and safe failure, deployed tested Solana program with transaction links, reproducible reveal verifier, clearly non-transferable completion record, complete videos/forms and final review. A measured real-venue effect, real users, partner interest and real-device battery remain unproven under current constraints. The target100 is a quality goal, not a claim of guaranteed score or award.
