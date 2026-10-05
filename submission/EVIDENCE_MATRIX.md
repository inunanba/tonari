# TONARI — claim-to-evidence and submission gates

Status: **FULL NO-GO**. This table is the source of truth for what media and forms may say.

| Claim | Level | Evidence | Allowed wording / boundary |
|---|---|---|---|
| Wallet-free judge route reaches 24/24 | Proven in host browser | `tests/judge-browser.cjs`, public PR #24, Chrome x2 | Say “judge route”; it starts from an explicitly shortened 18-piece state. |
| Offline dual-signature exchange | Proven in browser harness | rally/QR/storage/browser evidence | Say “genuine Ed25519 signatures”; do not imply two physical phones. |
| Public Solana program | Proven on Devnet | program `2XaNub…63iA`, deploy record | Always say Devnet/prototype; authority is not immutable. |
| Dual-signature `settle_swap` | Proven on Devnet | tx `qfTeQ1…T7Zd` | May say public settlement; committed frontend/relay limitations remain documented. |
| Actual Chrome quality gate | Proven for R2h | 154/154 Node; judge x2; inherited browser regressions; PR #24 | The 4.2 s figure is harness wall time, not human completion time. |
| Quiet-spot and queue-offer behavior | Proven only as deterministic demo/model | allocator tests and operations browser | Say simulated sensor feed / stylised model, never real crowd control. |
| −26%, 2.0 min, zero base-case herding | Model output | checked-in simulator research/golden vectors | Say simulation result, not measured venue impact. |
| Users, venue partnership, pilot, revenue | Unproven | none | State none; pilot is a proposal. |
| Physical phones / real camera / battery | Unproven | none | Do not claim. Three-phone view is browser emulation. |
| Completion cNFT/non-transferable keepsake | **Open blocker** | none accepted yet | Do not claim implemented, minted or wallet-readable. |
| Completed videos and submission | **Open blocker** | no public URLs/receipts | Drafts are not completion. |

## GO gates

- [x] Public repo, MIT source, public demo route.
- [x] Actual Chrome judge path and inherited regressions pass on merged public source.
- [x] Public Devnet program and dual-signature swap evidence.
- [ ] Completion cNFT, or owner-approved honestly labelled fallback with recorded point loss.
- [ ] Public pitch video ≤2:00 on YouTube, Loom or Vimeo; verified voice credit and English subtitles.
- [ ] Public technical demo ≤2:00.
- [ ] Actual Superteam and Colosseum form fields/limits captured; all valid optional fields completed without invention.
- [ ] Fresh-browser link check, final tests, adversarial claim review and current evidence hashes.
- [ ] Work final integrated score and GO.
- [ ] Owner final OK.
- [ ] Bot/owner submission receipts.

Owner-supplied Telegram is a hard Colosseum form gate. Work defaults accelerator opt-in to No and mobile-focused dApp to Yes; both remain editable before paste.

## Residual ownership

Work owns source, scripts, form drafts, tests, evidence review and final GO/NO-GO. Bot owns public recordings, verified VOICEVOX render, uploads, actual-form capture/paste, public integration and submission after authorization. The owner owns final OK and the Earn submit click. No document in this directory grants submission authority.
