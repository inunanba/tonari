# TONARI — claim-to-evidence and submission gates

Status: **FULL NO-GO**. This table is the source of truth for what media and forms may say.

| Claim | Level | Evidence | Allowed wording / boundary |
|---|---|---|---|
| Wallet-free judge route reaches 24/24 | Proven in host browser | `tests/judge-browser.cjs`, public PR #24, Chrome x2 | Say “judge route”; it starts from an explicitly shortened 18-piece state. |
| Offline dual-signature exchange | Proven in browser harness | rally/QR/storage/browser evidence | Say “genuine Ed25519 signatures”; do not imply two physical phones. |
| Public Solana program | Proven on Devnet | program `2XaNub…63iA`, deploy record | Always say Devnet/prototype; authority is not immutable. |
| Dual-signature `settle_swap` | Proven on Devnet | tx `qfTeQ1…T7Zd` | May say public settlement; committed frontend/relay limitations remain documented. |
| Actual Chrome quality gate | Proven through R2p | 184/184 Node; Chrome gates 10/10; local validator 34/34; PR #32/main `fdacfef3` | The earlier 4.2 s figure is harness wall time, not human completion time. |
| Three-tier missing-piece and queue-offer behavior | Proven only as deterministic demo/model | tiered-chance tests and operations browser | Say 3% seat / 1% crowded / 18% quiet, simulated crowd input / stylised model; never real crowd control. |
| −26%, 2.0 min, zero base-case herding | Model output | checked-in simulator research/golden vectors | Say simulation result, not measured venue impact. |
| Users, venue partnership, pilot, revenue | Unproven | none | State none; pilot is a proposal. |
| Physical phones / real camera / battery | Unproven | none | Do not claim. Three-phone view is browser emulation. |
| Completion PDA fallback | Proven on Devnet, with point loss | signed portable record + finalized PDA/readback; R2o/R2m evidence | Say “signed completion record anchored to a Devnet PDA.” It is **not** a cNFT/token and does not prove non-transferability. |
| Completion cNFT/non-transferable keepsake | Not implemented | no accepted cNFT/non-transferability evidence | Do not claim implemented, minted, non-transferable or wallet-readable. This is a recorded score loss, not a hidden claim. |
| Completed videos and submission | **Open blocker** | no public URLs/receipts | Drafts are not completion. |

## GO gates

- [x] Public repo, MIT source, public demo route.
- [x] Actual Chrome judge path and inherited regressions pass on merged public source.
- [x] Public Devnet program and dual-signature swap evidence.
- [x] Owner-approved honestly labelled completion-PDA fallback shipped, with cNFT/non-transferability kept `NOT_VERIFIED` and point loss recorded.
- [ ] Public pitch video ≤2:00 on YouTube, Loom or Vimeo; verified voice credit and English subtitles.
- [ ] Public technical demo ≤2:00.
- [ ] Actual Superteam and Colosseum form fields/limits captured; all valid optional fields completed without invention.
- [ ] Fresh-browser link check, final tests, adversarial claim review and current evidence hashes.
- [ ] Work final integrated score and GO.
- [ ] Owner final OK.
- [ ] Bot/owner submission receipts.

The current machine-readable preflight is `node tools/check-submission-readiness.mjs`. It must remain fail-closed until every media, owner-field and receipt placeholder is replaced with independently checked evidence.

Owner-supplied Telegram is a hard Colosseum form gate. Work defaults accelerator opt-in to No and mobile-focused dApp to Yes; both remain editable before paste.

## Residual ownership

Work owns source, scripts, form drafts, tests, evidence review and final GO/NO-GO. Bot owns public recordings, verified VOICEVOX render, uploads, actual-form capture/paste, public integration and submission after authorization. The owner owns final OK and the Earn submit click. No document in this directory grants submission authority.
