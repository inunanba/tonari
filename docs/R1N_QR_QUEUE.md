# R1n — retain QR actions while RPC is slow

R1m merged Exact12 public404c6a1c. Work independently verified blob+mode match,
main protocol37239844904/Pages37239844814 success, and inspected raw Devnet
attempt2 PASS. Bot reports Node82/native15/validator22/relay restart/Chrome5/
local browser PASS. Devnet attempt1 failed because third QR was not processed;
root cause was inferred from diagnostics. Source confirms read() silently
returned when busy was true. The harness's options-length condition could be
true before its refresh request finished. This is a concrete loss mechanism,
though no original runtime trace proves it caused that particular attempt.

Refresh/read/consent/cancel now share a bounded FIFO (4 including running).
A scanned or selected QR waits behind the active operation instead of being
discarded. An error rejects that action visibly and never blocks the next one.
At execution the current participant/intent/ownership conditions are checked;
queued consent cannot use a replaced pending record. Backlog overflow explicitly
asks the user to wait and select the image again. No automatic consent is added.
The camera still stops after successful receipt and foreground controls remain.

The document exposes actionState/actionCount for end-to-end readiness. The
harness waits for refresh completion, and also deliberately holds an already
received state response while uploading the third device's foreign offer. It
must observe two queued actions and then the correct NOT_PARTICIPANT message
after release. This reproduces the old loss independently of network speed.
All prior real dual-finality/offline/one-hour-fast assertions remain.

The footer now follows validated cluster configuration. Devnet identifies test
SOL and unfinished judge hosting; local mode identifies local transactions.
A unavailable endpoint never claims Devnet readiness. SW0.7.5 precaches queue.
Node87 PASS includes slow-refresh FIFO, recovery after rejection, overflow,
local/Devnet copy, and consent pinned to the reviewed offer body. Real browser retest remains Bot host work.

## Devnet receipt recovery evidence gap

R1m host restart preserved config and tiles, but the browser disposed its packet
before a repeated settle POST. The local validator already proves this path.
For the next Devnet run Bot sets TONARI_TEST_RECEIPT_FILE to a temporary private
path outside the repo. The browser exports only config and public signed
packet/finalized proof (never a device private key). After a clean server stop
and restart using the SAME state directory, run:

```sh
node tools/check-relay-recovery.mjs
```

This re-verifies captured authority signature and dual phone packet, compares
show config, re-POSTs exact finalized packet, requires same proof/signature and
unchanged tile owners/versions. It never rotates slots, creates a new operator,
airdrops, upgrades or uses an owner wallet. Do not commit fixture/private state.
Return raw output and preserve both successful and failed attempts.

Root/claims/reveal/full24/game/cNFT/public judge sponsor/media remain unfinished.
Target100, internal44 unchanged, fullNO_GO/spend0. Bot PR/greenCI/host only;
Work retains all implementation and review.
