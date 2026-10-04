# R1a — persistent device and offline shell checkpoint

Scope: implementation chunk, not the full R1, not submission-ready. Builds on public R0 HEAD `2b581566744d69596029dfaad106be346721aa6d`; preserves the host Chrome launch configuration. Original R0 tests and new six local replay-policy tests pass (21 total). Browser tests below are authored, NOT run by Work because no Chromium/Chrome binary is present. R0 host browser PASS belongs to R0 only.

## Implementation

- Each of the three demo namespaces stores its own non-extractable Ed25519 CryptoKey in IndexedDB. Identity creation is serialized across concurrent opens and checked by a signature after restore. No private key export, wallet, money, or hidden backup.
- Packet cryptography finishes before the IndexedDB write transaction starts. The transaction reads the current receipt history, checks local nonce/pair/cooldown/participant rules, and commits signed bytes plus acceptance time and deletion of pending intent together. UI success and transmission follow the transaction complete event, not an individual put success event.
- Historical receipts are revalidated from immutable signed packet bytes at their stored acceptance time. This permits display after expiry; it never accepts an expired offer as a new exchange. Replayed nonce, changed nonce for the same pair, backward time and packets where this device is not a participant fail closed.
- Pending outgoing/incoming intent survives reload. Recipient's committed packet is a resendable outbox. Resend is limited by the original 120-second offer expiry; an undelivered expired exchange still requires the future settlement/reconciliation path. Local acceptance is PROVISIONAL, never final ownership.
- A versioned service worker caches only an explicit same-origin app-shell list. Phone query `client=0/1/2` maps to the cached phone HTML. Offline-ready appears only after installation and page control. First visit still requires the pack to load successfully. App cache updates do not erase device DBs.
- Storage denial, clone failure, corruption, blocked schema or commit failure stops the flow visibly. We do not replace storage failure with temporary keys and pretend preservation worked.

## Actual / pending evidence

| Gate | Actual result |
|---|---|
| Node protocol and policy | 21/21 PASS, no skipped tests |
| JavaScript parse checks | all changed JS checked locally |
| Real IDB transactions, CryptoKey clone, concurrent handles, injected abort | authored `tests/storage-browser.cjs`; HOST_PENDING |
| Reload with network disabled, same three keys and two restored receipts | authored extended `tests/browser-check.cjs`; HOST_PENDING |
| Power-loss flush, storage eviction, iOS/Safari, privacy mode | NOT_PROVEN |
| QR camera, complete replay-resistant multi-phone flow | NEXT implementation |
| Global ownership, anti-Sybil, on-chain settlement | NOT_IMPLEMENTED |

Run on an actual browser host with Node24 and system Chrome:

```sh
npm test
npm run demo
# in another terminal with the local server running:
TONARI_CHROME_PATH=/usr/bin/google-chrome-stable node tests/storage-browser.cjs
TONARI_CHROME_PATH=/usr/bin/google-chrome-stable node tests/browser-check.cjs
```

No mocked-IDB success is substituted for those actual browser gates. Same-origin iframe separation remains component isolation, not a security boundary against compromised same-origin JavaScript. Transaction durability does not guarantee survival of device loss or browser eviction.

## Measured internal score and gap to 100

Official criterion weights are not established; this is our internal formative rubric, not an official prediction. R0 earned25; public source/CI and R0 host browser evidence now consumed as recipient-attested evidence, with new storage code still browser-pending.

| Criterion | Earned / maximum | Gap | Concrete closure evidence |
|---|---:|---:|---|
| Functionality/code |5/20|15| Actual IDB/offline tests, real QR path, Python/TS golden parity, Anchor ownership and negative tests, deployed devnet receipts |
| Impact |4/15|11| Bound research citations and reproducible crowd scenarios; real venue outcomes remain unproven |
| Novelty |8/15|7| Demonstrate crowd-aware rare-placement lever and auditable policy; strongest rival walkthroughs still COVERAGE_INCOMPLETE |
| UX |5/20|15| Judge-timed 3-phone story, interruption recovery, one-handed silent games, mobile accessibility, QR roundtrip |
| Open source/composability |6/15|9| Public initial repo/CI exists; full verifier CLI, adapter examples, reproducible program builds and receipts pending |
| Business |3/15|12| Clear buyer/cost/adoption hypothesis, truthful sponsor fit and pitch; validated buyer/pilot/pricing remain unproven |
| **Total** |**31/100**|**69**| **BUILD_CONTINUES / SUBMISSION_NO_GO** |

100 remains the build target, not an evidence claim. No venue outreach, physical filming or owner face/voice is authorized. Within the deadline, actual adoption, calibrated crowd-safety effects and validated buyers cannot be invented or guaranteed; the best supportable alternative is explicitly bounded research, reproducible simulations, a complete working demo and a testable pilot/cost hypothesis. A defensible final numerical ceiling depends on completed evidence and independent review; none is asserted now.

Work keeps general implementation. Bot residual is public PR/checks/merge and actual host browser checks only. Continue QR, allocation parity and Anchor while host evidence is pending. No spend, wallet, program deploy or public submission in this chunk. Mandatory operating-policy security inheritance retained.
