# TONARI — claim-to-evidence and submission gates

Status: **COLOSSEUM SUBMITTED / EARN PENDING OWNER SUBMIT**. This table is the source of truth for what media and forms may say; it grants no new submission authority.

| Claim | Level | Evidence | Allowed wording / boundary |
|---|---|---|---|
| Wallet-free judge route reaches 24/24 | Proven in host browser | `tests/judge-browser.cjs`, public PR #24, Chrome x2 | Say “judge route”; it starts from an explicitly shortened 18-piece state. |
| Offline dual-signature exchange | Proven in browser harness | rally/QR/storage/browser evidence | Say “genuine Ed25519 signatures”; do not imply two physical phones. |
| Public Solana program | Proven on Devnet | program `2XaNub…63iA`, deploy record | Always say Devnet/prototype; authority is not immutable. |
| Dual-signature `settle_swap` | Proven on Devnet | tx `qfTeQ1…T7Zd` | May say public settlement; committed frontend/relay limitations remain documented. |
| Actual Chrome quality gate | Proven through R2v | 189/189 Node; Chrome gates 10/10; local validator 34/34; PR #35/main `e4fa3361` | The earlier 4.2 s figure is harness wall time, not human completion time. |
| Three-tier missing-piece and queue-offer behavior | Proven only as deterministic demo/model | tiered-chance tests and operations browser | Say 3% seat / 1% crowded / 18% quiet, simulated crowd input / stylised model; never real crowd control. |
| −26%, 2.0 min, zero base-case herding | Model output | checked-in simulator research/golden vectors | Say simulation result, not measured venue impact. |
| Users, venue partnership, pilot, revenue | Unproven | none | State none; pilot is a proposal. |
| Physical phones / real camera / battery | Unproven | none | Do not claim. Three-phone view is browser emulation. |
| Completion PDA fallback | Proven on Devnet, with point loss | signed portable record + finalized PDA/readback; R2o/R2m evidence | Say “signed completion record anchored to a Devnet PDA.” It is **not** a cNFT/token and does not prove non-transferability. |
| Completion cNFT/non-transferable keepsake | Not implemented | no accepted cNFT/non-transferability evidence | Do not claim implemented, minted, non-transferable or wallet-readable. This is a recorded score loss, not a hidden claim. |
| Public pitch and demo videos | Pitch signed-out proven; replacement demo receipt-bound, recheck pending | Pitch `FS4sn8_zRHU` (1:58); current demo `eZR5a1Bb414` (2:04), owner-approved R2u render used in Colosseum receipt | Former demo `yHdKe_2xoMI` is obsolete. Recheck current demo signed out before Earn. |
| Colosseum submission | **Submitted** | Status “Submitted” at 2026-10-07 00:17 JST; project ID 15996; project/profile URLs recorded by Sena | Do not repeat submission. Public project availability is a separate verification from the authenticated receipt. |
| Superteam Earn submission | **Pending owner submit** | Colosseum receipt satisfies the prerequisite; no Earn receipt yet | Owner reviews/ticks the required Japan KYC and track-scope acknowledgements and performs the human-only submit. |

## GO gates

- [x] Public repo, MIT source, public demo route.
- [x] Actual Chrome judge path and inherited regressions pass on merged public source.
- [x] Public Devnet program and dual-signature swap evidence.
- [x] Owner-approved honestly labelled completion-PDA fallback shipped, with cNFT/non-transferability kept `NOT_VERIFIED` and point loss recorded.
- [x] Public pitch video ≤2:00 on YouTube, Loom or Vimeo; verified voice credit and burnt-in English subtitles.
- [x] Public technical demo 2:04, within Colosseum's ≤3:00 limit.
- [x] Owner Telegram supplied and wired without invention.
- [x] Actual Superteam and Colosseum form fields/limits captured; all currently available fields completed without invention.
- [x] Fresh-browser link check, final tests, adversarial claim review and current evidence hashes.
- [x] Work final integrated score and GO for owner review.
- [x] Owner final OK (2026-10-06 23:19 JST).
- [x] Colosseum owner-authorized submission receipt and project/profile URLs.
- [ ] Replacement demo signed-out recheck.
- [ ] Superteam Earn owner submit and receipt.

The current machine-readable preflight is `node tools/check-submission-readiness.mjs`. It records Colosseum as submitted and Earn as pending. `submissionAuthorized` remains false because the prior Colosseum authorization was consumed and the remaining Earn click is owner-only.

Owner-supplied Telegram is a hard Colosseum form gate. Work defaults accelerator opt-in to No and mobile-focused dApp to Yes; both remain editable before paste.

## Residual ownership

Work owns source, scripts, form drafts, tests, evidence review and final GO/NO-GO. Bot owns public recordings, verified VOICEVOX render, uploads, actual-form capture/paste, public integration and submission after authorization. The owner owns final OK and the Earn submit click. No document in this directory grants submission authority.
