# R1m — reviewed operator Devnet exchange

R1l host evidence: Exact9, Node78/native15/validator22/relay/Chrome5 and actual
one-hour-fast browser exchange PASS. Work independently checked public blob
matches and main protocol/Pages CI, inspected raw chain-browser PASS, and read
Devnet RPC: expected genesis, executable TONARI program, successful finalized
qfTeQ1TryvERBEVJCsgiqSSfYusHSBGhN5cmVko4j3uZoLbFVRYd1V5zbh1hAipeFXwBHS3tvusCcAn8koVT7Zd.
Bot PR15 deployment/docs are preserved; no program source changed.

## Scope

The operator may run the committed browser exchange against public Solana
Devnet through a server bound ONLY to 127.0.0.1. This is not a public sponsor,
production service, or an API endpoint supplied by GitHub Pages.

Devnet RPC is exactly https://api.devnet.solana.com and getGenesisHash must match
EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG. Reference:
https://github.com/solana-labs/solana/blob/master/sdk/src/genesis_config.rs
https://solana.com/docs/rpc/http/getgenesishash
Work read back the live official RPC before implementing the pin; a future
Devnet reset requires explicit review rather than accepting another cluster.

The signer is the existing DEVNET operator
8k7ygJWhiRu5BrPuvHPesR7CH1QTBmNEMJvFDpRjLFWf, supplied by Bot locally. No wallet
prompt, owner wallet, alternate payer, real currency, faucet, mainnet or remote
RPC fallback. Minimum test balance 0.03 SOL; 3 device slots, 3 issued tiles each,
serial sponsorship, fixed-size packets. Existing join/settle signature, marker,
transaction-shape and finalized-account verification are reused unchanged.
This operator is also the program upgrade authority; that trust is explicit.

## Bot setup only

Keep the existing operator key file outside every repository. Do not copy,
print, upload or commit its contents. Set these environment variables locally:
TONARI_DEVNET_OPERATOR_FILE = absolute path to the existing test key file.
TONARI_DEVNET_STATE_DIR = absolute private directory outside the repository.
Then run:

```sh
node tools/serve-devnet.mjs
```

Open http://127.0.0.1:4173/apps/web/swap.html?client=0 (and client=1/2).
Same-origin API guards remain unchanged. In Devnet final state the UI labels
Solana Devnet and links the exact authority-attested finalized signature to
Explorer with cluster=devnet. Local runs retain local wording and no external
transaction link. Service worker version 0.7.4 refreshes the browser modules.

## Restart and recovery

show.json stores only public show seed and device slot bindings, with strict
schema. Atomic write/rename + fsync and a process lock keep the same show across
restart. Existing chain Show/authority/policy/cap and every bound Ticket are
checked. Client keys and receipts remain in browser IndexedDB. Successful
settlements whose response was lost recover by exact finalized chain history,
including after restart without an in-memory receipt cache.

Show lasts 30 min. After expiry, existing finalized receipts still recover;
new exchanges require a deliberately new test session, never an automatic
reissue. Do not remove a live relay.lock. If an operator process crashes, Bot
must verify it is gone before removing the stale lock and restarting. A stale
lock fails closed. Never rotate state while any provisional exchange remains.
This is bounded development hosting; long-lived multi-user public sponsorship,
budgets/rate control, recovery ops and judge deployment remain separate work.

## Validation

Work Node82 PASS includes strict Devnet/mainnet/RPC/operator gates, public
Explorer presentation, persistent slot/seed restart, double-process lock,
corrupt metadata and immutable bindings. Real local relay integration now
checks restart and chain-history receipt recovery. Browser harness supports
TONARI_BROWSER_CLUSTER=devnet and checks Devnet UI/link while keeping all
previous offline/clock/finality assertions. Bot must run actual host tests:

```sh
TONARI_CHAIN_BROWSER=1 tools/run-local-chain.sh
TONARI_BROWSER_CLUSTER=devnet node tests/swap-chain-browser.cjs
```

The second command requires serve-devnet already running with existing funded
test operator, persistent metadata, fresh browser devices. Work never loaded
operator keys or sent Devnet transactions. R1m actual host retest PENDING.
Root/claims/reveal/cNFT/games/solo completion/media and final review remain
incomplete. Target100; full submission NO_GO; spend0.
