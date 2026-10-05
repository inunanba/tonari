# TONARI — paste-ready form answer draft

Status: **DRAFT / LINKS AND ELIGIBILITY MUST BE RECHECKED / NOT SUBMITTED**.

## Shared facts

- Project: **TONARI**
- Team: **Solo builder**
- Country: **Japan**
- Repository: https://github.com/inunanba/tonari
- Live demo: https://inunanba.github.io/tonari/apps/web/judge.html
- X: leave blank; no account is claimed.
- Pitch video: `<PUBLIC_PITCH_VIDEO_URL>`
- Technical demo: `<PUBLIC_TECH_DEMO_URL>`
- Colosseum project/profile links: `<CAPTURE_FROM_ACTUAL_FORM>`

## One-liner

Offline neighbour play that turns venue rewards into a verifiable, safety-bounded crowd-control lever on Solana.

## Short description

TONARI turns three idle minutes beside a stranger in a low-signal venue queue into wallet-free offline play. Phones exchange rotating QR payloads and co-sign the same swap; Queue Line and Call & Response add brief, non-coercive play. A deterministic allocator lowers rewards at busy locations, suggests quiet spots only within caps, and offers decline-safe virtual-queue slots. The product is sensor-adapter ready and demoed with a simulated feed. Its browser signatures map directly to the Ed25519 verification used by a public Solana Devnet program, where a dual-signature swap has been settled. TONARI is a free keepsake experience with no resale, paid chance, streaks or complete-gacha mechanic. The venue model is a signage-only pilot measuring offer acceptance, wait distribution and cap violations; no venue partnership or production users are claimed.

## Problem

Large venues have two adjacent problems: guests lose time in queues with weak connectivity, while naive “rare at the quiet spot” incentives can create a new crowd. Existing collection mechanics reward movement but generally do not make the induced load a verifiable safety constraint.

## Solution and differentiation

TONARI combines offline multiplayer, signed QR exchanges, short games, decline-safe time-shift offers and a deterministic governed allocator. Probability is capacity-relative, damped, capped and fail-closed. The same phone keys sign offline and settle on Solana, so the interaction and audit path share one cryptographic identity. In a stylised base simulation—not a field measurement—the busiest spot fell 26%, the worst quiet-spot wait stayed at 2.0 minutes and no induced-herding incident occurred.

## Target user and buyer

Users are solo or small-group guests waiting at concerts, sports and exhibitions. The buyer is a venue, promoter or event operator seeking a low-hardware engagement layer and measurable demand shaping. The proposed first step is a signage-only pilot using existing phones and displays; this is a proposal, not an existing partnership.

## Why Solana

Browser devices and Solana both use Ed25519, allowing the same ephemeral phone identity to sign an offline exchange and be verified on-chain without a wallet prompt. Low-cost settlement supports batched venue-scale proofs. The Devnet prototype verifies signed swaps and publishes auditable state; production economics and throughput have not yet been field validated.

## Technology

Offline-first JavaScript PWA, Service Worker, IndexedDB, WebCrypto Ed25519, local QR encoder/decoder, deterministic TypeScript allocator and games, Node test harnesses, an Anchor/Rust Solana program, relayer and public Explorer evidence. Sensor input is simulated behind an adapter boundary.

## Traction and validation

There are no claimed production users, revenue, venue pilot or partner. Current evidence is a public MIT repository, CI, a no-wallet judge route, actual Chrome regression runs, a public Devnet program and settlement transaction, reproducible model vectors, and documented limitations. Public fan posts informed the low-signal/queue UX but were not interviews or endorsements.

## Business model

Proposed B2B event licensing: a fixed show setup fee plus an operations/analytics tier, starting with a signage-only proof of concept. Success metrics are median and worst wait, offer acceptance, induced-load cap violations, completion rate and support burden. Pricing and ROI remain hypotheses until a buyer conversation is allowed.

## Guardrails

Free; no resale; no paid chance; no complete-gacha mechanic; no loss for declining an offer; no continuous-login reward; original venue-neutral art; no venue or artist marks; simulated sensor feed is labelled; Devnet is labelled; collection is a keepsake, not an investment.

## Superteam Earn field map

| Field | Answer |
|---|---|
| Project Name | TONARI |
| Project Description | Use “Short description” above. |
| GitHub | https://github.com/inunanba/tonari |
| Website | https://inunanba.github.io/tonari/apps/web/judge.html |
| Pitch deck or Loom/video | `<PUBLIC_PITCH_VIDEO_URL>` |
| Submitted to official Colosseum World's Fair? | Set **Yes only after an actual Colosseum submission receipt exists**; until then this field is blocked. |
| X | Blank by owner decision. |
| Colosseum project/profile | Replace `<CAPTURE_FROM_ACTUAL_FORM>` after the actual URLs exist. |

## Colosseum superset

Use the one-liner, short description, problem, solution, target user/buyer, why Solana, technology, validation, business model and guardrails above. Choose Country **Japan** and the Solana track only if the actual UI offers it. Team is “Solo builder.” If the form explicitly asks about AI or tools, answer the actual wording truthfully; do not invent or pre-answer a field that has not been captured.

## Paste gate

Do not paste until every placeholder is replaced, the live links are opened in a signed-out fresh browser, the actual form labels and character limits are captured, current eligibility is confirmed, Work has issued final GO and the owner has issued final OK. Earn submit remains owner-only.
