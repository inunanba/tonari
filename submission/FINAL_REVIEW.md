# TONARI — provisional integrated review

Status: **WORK FINAL GO / COLOSSEUM SUBMITTED / EARN PENDING**. Public source, CI, Pages, live demo, media, owner Telegram, claims and hashes passed the integrated Work review. Owner final OK was recorded at 2026-10-06 23:19 JST; the owner-authorized Colosseum submission was recorded at 2026-10-07 00:17 JST.

| Criterion | Score | Evidence | Lost points / closure |
|---|---:|---|---|
| Functionality | 18/20 | 189/189 Node; Chrome 10/10; validator 34/34; Devnet swap and completion PDA | −2: completion is a PDA fallback, not a cNFT/non-transferable asset. |
| Impact | 12/15 | deterministic capped 3%/1%/18% model; allocator and governor evidence | −3: no real venue deployment, users or measured crowd result. Do not replace model evidence with a field claim. |
| Novelty | 15/15 | offline co-signed neighbour play plus governed missing-piece distribution and same-key Solana settlement; public pitch/demo | Media demonstrates the current prototype and preserves the proposal/roadmap boundaries. |
| UX | 19/20 | wallet-free judge path, original 24-fragment picture, two games, offline reload, actual Chrome gates and public media | −1: physical-device/camera use is unproven and not claimed. |
| Open source / composability | 15/15 | MIT public repo, protocol/allocator/games modules, tests, verifier and evidence docs | Preserve reproducible public hashes in the final evidence capture. |
| Business | 11/15 | venue/operator buyer and signage-only pilot proposal are explicit | −4: no buyer interview, pilot, partnership, revenue or field economics. Never invent them. |
| **Total** | **90/100** | Evidence above | Target remains 100; current truthful evidence score is 90. The recorded PDA fallback and lack of field validation prevent an evidence-based 100. |

## Work final decision

- **GO for owner final review** at public main `e4fa3361b9d845aa63dfe7ac4e8df1134730c8b1`.
- Independent Bot evidence: PR #35 merged; Exact9 public readback 9/9; Node 189/189; protocol run `37460978692` and Pages run `37460978631` succeeded.
- Signed-out checks passed for the public repository, judge route, pitch and demo. Media duration evidence is 1:58 and 1:54, within the stated limits.
- Claims remain bounded: cNFT and non-transferability are `NOT_VERIFIED`; completion is the disclosed signed Devnet PDA fallback.
- Colosseum gate is closed: project https://colosseum.com/arena/projects/tonari and profile https://colosseum.com/arena/profiles/inunanba are recorded. Do not repeat submission.
- Required next gate: fresh signed-out check of replacement demo `eZR5a1Bb414`, then owner-only Superteam Earn submit and receipt capture.

Run `node tools/check-submission-readiness.mjs`. A zero exit confirms the recorded source is internally consistent; it does not authorize another external action. The machine result keeps `submissionAuthorized=false`, records `colosseumSubmitted=true`, and keeps `earnSubmitted=false` until an Earn receipt exists.

## Permanent truth boundary

The completion record and finalized PDA are real Devnet evidence. They are not a cNFT, token or proof of non-transferability. The fallback satisfies the owner's documented cut path with a recorded score loss; it does not silently satisfy the original cNFT claim.
