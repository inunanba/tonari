# R1c — QR image and standalone phone exchange

Chunk complete, full build continues. R1a public merge32ff864ff94389f65ea393f382dbcd0919366806 verified: Work independently matched all14 source SHA256, both returned browser/storage log hashes and byte sizes, PR1 actual merged state and PR/main CI success against exact heads. R1a host tests prove stored keys/receipts and offline reload in Chrome. No physical-device/Safari result is borrowed from those checks.

## Implemented now

- `exchange.html?client=0/1/2` is a standalone, silent phone experience. Separate phone namespaces preserve independent keys. It uses actual QR image bytes, without the parent postMessage transport used by the first preview. Initial tile placement is a labelled three-piece simulation; the app still has no on-chain ownership proof.
- Recipient shows public key card; offerer chooses two pieces and reads it; recipient reads signed offer, checks target and locally modelled piece, explicitly accepts or declines; receipt QR returns both signatures to original offerer, who matches the original body before storing. No private key, URL or wallet deep link enters the QR.
- PNG/JPEG/WebP file-image input is implemented; camera uses local getUserMedia and pure JS decoder, no external recognition service. Camera stops after a result/error, on stop, pagehide and hidden document. A permission request resolved after cancellation closes its returned tracks. Permission denial keeps image input usable. Real camera behavior remains HOST/DEVICE_PENDING.
- Persisted pending offer/confirmation and completed recipient receipt survive reload. Expired intent may be cleared on reopening; expiry is never extended. Recipient may re-display its receipt to finish delivery within the original120s TTL. Global settlement and delayed-expired delivery are unresolved.
- Offline shell now includes pinned QR runtime assets and standalone phone route. First visit needs the pack to load. Third-party license/provenance and offline vendor rebuild are retained. Libraries are not claimed as TONARI inventions.

## Evidence

| Gate | Result |
|---|---|
| Full Node protocol/policy/wire/image suite |30/30 PASS, fail0 skip0;331.654117ms |
| Independent image encoder/decoder |K/O/R stages at2/4/6px per module, 90° rotation, inverted colors, blank/malformed images PASS |
| Vendor original identities |4/4 upstream Git blob MATCH; exact commits in UPSTREAM.json |
| Reproducible vendor runtime build |2/2 byte-identical rebuild on Node24.19.0 |
| JS parse checks |16 current browser/protocol/vendor/browser-test files PASS |
| Standalone UI, file input, cancellation/restore, SW new shell |Authored `tests/qr-browser.cjs`; HOST_PENDING |
| Physical camera / iPhone Safari / actual scan distance |NOT_PROVEN |
| Chain ownership/settlement/cNFT, allocator/games |Not implemented yet |

Host browser test intentionally uses generated PNGs through the actual file-input route: three independent page keys, offline image exchange, wrong-third-recipient rejection, pending/completed reload, camera-denied fallback and receipt counts1/1/0. It must not be reported as physical camera/phone proof.

## Measured gap to100 (internal rubric)

| Criterion | Earned / max | Gap | Closure |
|---|---:|---:|---|
| Functionality/code |7/20|13| Standalone browser gates, expiry/reconciliation recovery, Python/TS golden allocator, Anchor proof/replay tests and devnet receipts |
| Impact |4/15|11| Reproducible bounded scenarios and evidence citations; no invented venue/pilot/crowd-safety results |
| Novelty |8/15|7| Working rare-placement operator lever plus strongest-rival walkthrough; coverage still incomplete |
| UX |7/20|13| Actual new mobile UI tests, judge timing/accessibility/one-handed games, full completion path and camera fallback proof |
| Open source/composability |7/15|8| Public new slice/CI, independently runnable verifier/adapter, program builds and provenance |
| Business |3/15|12| Clear buyer/adoption/cost hypothesis and pitch; actual validated buyer/pilot unproven under no-outreach constraint |
| **Total** |**36/100**|**64**| **BUILD_CONTINUES / SUBMISSION_NO_GO** |

The100 target is retained. The deadline and no-outreach/no-filming constraints do not justify claiming adoption, calibrated crowd safety or validated buyer demand. Best supportable within those limits is a complete working demo, reproducible simulation, honest evidence and pilot/cost hypothesis. Full marks and an award cannot be guaranteed; final supportable score waits on integrated evidence and review.

## Bot residual and next Work chunk

Bot: exact changed source (including earlier wire files) atop actual public32ff864…, public PR/checks green, Node30tests, all3 existing/new browser scripts. Preserve screenshots/unrelated newer changes. Return exact source/head/PR/CI/JSON/logs/new mobile screenshot. Work fixes any implementation failures. No real camera claim from png-fixture test, no deploy/spend/wallet/secret/submission in this request.

Work: allocator Python extraction and TypeScript golden parity, rare-placement simulator/operator console and Anchor atomic ownership/version design. Do not wait for browser evidence to write those. Current three-piece demo does not yet implement all24-piece issuance/games/cNFT. Mandatory operating-policy security inheritance and final ownerOK remain.
