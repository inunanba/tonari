# Third-party components and evidence

Runtime v0.3: platform WebCrypto plus the two pinned local QR libraries below. No CDN, tracking or runtime package installation. Node24 test runner. Optional browser verification uses Playwright, provided externally and not vendored. Font: system font. UI uses original CSS and plain glyphs, no venue/artist logos.

| Component | Pin | License | Preservation / adaptation |
|---|---|---|---|
| Nayuki QR-Code-generator |3c6d0b3cefb4e049dc337e82237c9644399716a8|MIT|Exact upstream qrcodegen.ts with full license/copyright; transformed by Node24 and ESM export added |
| jsQR 1.4.0 (cozmo/jsQR) |8e6a036beafa7053dd44b1b76ac578d22b1b3311|Apache-2.0|Exact upstream dist, LICENSE and package attribution retained; ESM adapter added |

`vendor/UPSTREAM.json` records source paths, upstream Git blob identities, SHA256 and byte sizes. All4 upstream copies independently Git-blob-matched. `node tools/build-qr-vendor.mjs` rebuilds both runtime files offline with Node v24.19.0; 2/2 byte-identical rebuild checked. These libraries perform encoding/decoding, never ownership or identity verification. Original TONARI source remains MIT; third-party terms remain as above.

No narration exists yet. VOICEVOX voice selection, exact voice terms and required `VOICEVOX:<voice name>` credit must be finalized before media output. No third-party voice likeness is requested.

Future Anchor/Agave/Metaplex libraries must record pinned versions and licenses when adopted. Source provenance and comparison links are in R0_REVIEW.md. Research data from the team's canonical TONARI pack is not presented as independently measured venue evidence.

## R1h development and program dependencies

| Component | Pin | License | Usage |
|---|---|---|---|
| @solana/web3.js |1.98.4|MIT|Node-only development client and local harness; never imported by PWA|
| fake-indexeddb |6.2.4|Apache-2.0|Node-only storage migration/atomicity tests; never imported by PWA|
| anchor-lang |0.32.1|Apache-2.0|Account constraints and program macros; full transitive versions/checksums in Cargo.lock|
| solana-sha256-hasher |2.3.0|Apache-2.0|Native hash / SBF SHA256 syscall binding|
| solana-sdk-ids |2.2.1|Apache-2.0|Canonical native program ids|
| Agave tools |2.3.0|Apache-2.0|External first-party compiler/localhost validator, not vendored|

Cargo.lock and package-lock.json pin the dependency graphs. Native SDK implementation remains under its own licenses; TONARI's original application code stays MIT. No node_modules or toolchain binaries are copied into the repository. Metaplex adoption remains pending.
