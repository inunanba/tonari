# R1j — recover the browser confirmation path

Bot's R1i host result independently passed Node66, Rust15, actual validator22,
the actual relay response-loss/marker-recovery test and all five existing Chrome
suites. Public PR11 and both main CI workflows passed at
`cec2de1dce6d32b7f98606a84cb5f0539334fa4a`. The new browser-to-chain test failed
after 180 seconds waiting for the finalized UI. Its raw log contains only that
timeout, so the exact browser/root cause remains **UNKNOWN**. Backend success
does not prove the UI path. No chain or UI success is invented here.

The R1i UI only requested automatic confirmation on the `online` event; restoring
a provisional receipt merely rendered it. The fix adds a bounded confirmation
controller which starts from the restored record and independently checks
connectivity on a visible page. A missed `online` notification no longer leaves
the record without an automatic recovery path. Online/focus/visible-page hints
and the explicit button share one in-flight guard. Finalized records and pagehide
cancel timers. Offline/hidden checks make no requests and consume no retry count.
Transport failures permit at most three automatic attempts (2-second initial
check, then 15 seconds between checks). Signature, program or storage failures
stop automatic retries; the stored packet and manual recovery remain available.
It never replaces the packet, bypasses receipt verification, or displays
confirmation before the signed finalized receipt is committed.

Work Node73/73 passes (R1i66 plus five controller tests and two storage tests), including missed online
notification, network retry budget/manual recovery, simultaneous hints/button,
hidden/offline/no-request behavior, terminal failures, and timer cancellation.
The new browser test intentionally suppresses the online event and must still
reach the actual finalized state on both devices. Every failure now prints both
participants' phase/status/chain-status/network/visibility state and API HTTP
errors/request failures, plus screenshots. This makes a remaining protocol,
storage, backend or browser issue distinguishable instead of reporting only a
timeout. Actual browser-to-chain success is still **HOST_PENDING**.

The sender may reopen after the other device has already finalized. Restoring its
signed intent now permits reading the peer result even when the current owners
have advanced. Importing that historical packet requires an authority-signed
finalized receipt for its exact id and re-verifies both device signatures at the
attested settlement time. It does not bypass owner checks for a new provisional
swap. The packet, finalized proof and clearing its matching intent commit
atomically. Forged/foreign proofs leave the pending intent untouched.

R1h/R1i program and relay code is unchanged. Bot only needs the new exact source
overlay via PR+green CI, actual local browser reproduction, existing regressions
and evidence. Use the same launcher with `TONARI_CHAIN_BROWSER=1`; preserve
public Pages' npm-ci correction and all unrelated public changes. If it fails,
return the new diagnostics without silently changing Work source. No submission,
public local-relay deployment, real funds, owner keys, mainnet or outreach.

Separately, Bot requested free Devnet funding to its already named deployer
`8k7ygJWhiRu5BrPuvHPesR7CH1QTBmNEMJvFDpRjLFWf`. Work's own RPC read observed
zero balance and one authorized 2-SOL `requestAirdrop` returned JSON-RPC -32603
Internal error, with no signature. It was not retried. No test funds arrived or
deployment is claimed. This is independent of the local browser failure.

The full project remains NO-GO for submission; target100 and formative36 are
unchanged. Issuance roots/claims, reveal, games/completion and production sponsor
still require implementation and verification.
