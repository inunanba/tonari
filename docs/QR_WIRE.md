# Historical R1b QR wire checkpoint — superseded by docs/R1_QR.md

The exchange has three stages: recipient's public-key card (K), offerer's signed intent (O), recipient's mutually signed receipt (R). Transport is exact canonical base64url ASCII with a `TONARI1:<type>:` prefix; no URL, wallet deep link, arbitrary JSON, private key or executable action. Decode never opens a URL and does not grant signature authenticity. Call the protocol's inspectOffer/inspectPacket and local transaction checks afterwards.

| Stage | Bytes | Text characters, prefix included | Next check |
|---|---:|---:|---|
| K / recipient public key |32|53| Show in person, reject self, bind recipient identity |
| O / 192-byte body + A signature |256|352| Correct show, TTL, A signature, B's own key, explicit confirmation |
| R / body + both signatures |320|437| Match original sent body, both signatures, local replay/participant policy, commit |

No padding, spaces, Unicode lookalikes, unknown version/type, oversized fields or alternate base64 representation are accepted. Original offer expiry still applies. A public key card does not prove a unique human. The signed tile identifiers are not current chain ownership proofs. Receiving remains provisional pending the future atomic settlement.

Actual tests: six new Node tests preserve real Ed25519 signatures across all three stages, exact sizes, bad domain/length/noncanonical bits, wrong-stage substitution and signature tampering. Full affected suite27/27PASS, no skips (188.559587ms). No camera, QR matrix generation, image decoding, scanning distance or physical phone result is claimed.

Next: pinned, license-preserved local QR encoder and image decoder, real camera lifecycle/permissions fallback, one-handed confirmation and in-browser generated-image roundtrips, then the host browser gate. Primary upstreams considered: Nayuki QR-Code-generator (typescript-javascript/qrcodegen.ts) and cozmo/jsQR (v1.4.0, Apache-2.0); no dependency has been vendored or shipped in this chunk, no upstream build was run. Do not claim the QR feature complete from a text-codec test.

R1a host request remains unchanged/immutable while generation176 is pending. This wire checkpoint adds no new Bot task or duplicate bell. Work retains implementation. Score31/100 unchanged because judge-visible scanning and end-to-end evidence are absent. Full build remains ACTIVE / BUILD_CONTINUES / SUBMISSION_NO_GO.
