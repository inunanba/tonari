# TONARI — provisional integrated review

Status: **FULL NO-GO / 88 OF 100 PROVISIONAL**. This is not Work's final GO. It records the current integrated product after R2p and the exact path to a final decision.

| Criterion | Score | Evidence | Lost points / closure |
|---|---:|---|---|
| Functionality | 18/20 | 184/184 Node; Chrome 10/10; validator 34/34; Devnet swap and completion PDA | −2: completion is a PDA fallback, not a cNFT/non-transferable asset. |
| Impact | 12/15 | deterministic capped 3%/1%/18% model; allocator and governor evidence | −3: no real venue deployment, users or measured crowd result. Do not replace model evidence with a field claim. |
| Novelty | 15/15 | offline co-signed neighbour play plus governed missing-piece distribution and same-key Solana settlement | No current source gap; final media must demonstrate rather than merely assert it. |
| UX | 17/20 | wallet-free judge path, original 24-fragment picture, two games, offline reload and actual Chrome gates | −2: pitch/demo media not public and signed-out checked; −1: physical-device/camera use is unproven and not claimed. |
| Open source / composability | 15/15 | MIT public repo, protocol/allocator/games modules, tests, verifier and evidence docs | Preserve reproducible public hashes in the final evidence capture. |
| Business | 11/15 | venue/operator buyer and signage-only pilot proposal are explicit | −4: no buyer interview, pilot, partnership, revenue or field economics. Never invent them. |
| **Total** | **88/100** | Evidence above | Target remains 100; current truth is 88 and NO-GO. |

## Hard blockers before Work final review

- Public pitch video at an approved host, at most 2:00, with English subtitles and `VOICEVOX:四国めたん` credit.
- Public technical demo at an approved host, at most 3:00 (the authored cut targets 2:00).
- Owner Telegram value; never infer or invent it.
- Signed-out fresh-browser checks for live demo, repository, pitch and demo URLs.
- Current live-form schema recheck, Colosseum receipt/URL, then Earn receipt-dependent fields.
- Fresh hashes/tests/adversarial claim review, followed by Work final GO or exact NO-GO.
- Owner final OK, then Bot/owner submission and receipt capture.

Run `node tools/check-submission-readiness.mjs`. A zero exit means only `READY_FOR_WORK_FINAL_REVIEW`; it never grants owner approval or submission authority.

## Permanent truth boundary

The completion record and finalized PDA are real Devnet evidence. They are not a cNFT, token or proof of non-transferability. The fallback satisfies the owner's documented cut path with a recorded score loss; it does not silently satisfy the original cNFT claim.
