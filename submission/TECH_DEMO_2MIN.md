# TONARI — 2-minute technical demo shot list

Status: **DRAFT / NOT RECORDED / NOT SUBMITTED**. Hard cap: 2:00. This cut shows evidence, not a feature montage.

Upload only to YouTube, Loom or Vimeo. Colosseum permits a product demo up to 3:00, but this stronger cut stays at 2:00.

| Time | Action | Evidence on screen | Spoken point |
|---|---|---|---|
| 0:00–0:16 | Open three independent clients and show distinct public keys. Toggle DevTools offline before the exchange. | Three namespaces and keys; offline indicator. | Browser-native Ed25519 identities; no wallet, login or runtime CDN. |
| 0:16–0:38 | Complete offer/accept QR round trip and reload both clients. | Both signatures verify; third client unchanged; completed state survives reload. | One canonical envelope, genuine dual signatures, atomic local persistence. |
| 0:38–0:55 | Run Queue Line and one Call & Response round. | Strict completion and grading; offline reload. | Game payloads reuse the signed protocol and do not gate paid value. |
| 0:55–1:15 | Press “Make G21 busy” in the operations view. | `stylised model` and `simulated sensor feed` labels; busy location gets no rare; caps/governor visible. | Deterministic allocator is fail-closed and safety bounded. Do not call this a real sensor deployment. |
| 1:15–1:35 | Open the program and `settle_swap` transaction in Solana Explorer. | Exact program and transaction IDs; Devnet badge. | The public Devnet transaction verifies both phone signatures through the Ed25519 precompile path. |
| 1:35–1:51 | Run `npm test`; scroll the public repository and protocol docs. | Green count, commit, MIT license. | The current public R2h build passed 154 Node tests and actual Chrome regressions; later commits must report their own count. |
| 1:51–2:00 | Show the evidence matrix and remaining-gates row. | cNFT/media/final review still open. | Prototype limits are explicit; completion is not claimed until every gate closes. |

## Capture requirements

- Record at 390×844 phone dimensions for the client panes and a readable desktop crop for Explorer/terminal.
- Use the public Pages deployment, except the deliberately offline segment.
- Do not paste private keys, operator state, local paths, notifications or authenticated tabs.
- The test count in narration must equal the tested commit. If R2i changes it, update the line before rendering.
- Return: two-minute-or-less MP4, SHA-256, public URL, captured public commit, browser version and a list of cuts.
- Add `VOICEVOX:四国めたん` in-video and in the description if the verified voice is used; recheck its terms at render time.
