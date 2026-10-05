# R1x local relay process restart

`tools/serve-chain.mjs` now restores all state that defines the local relay identity, not only the claim journal:

- the ephemeral local-validator payer keypair;
- the show seed;
- immutable client-slot public-key bindings;
- the claim operator journal.

The private local identity is stored in `local.json` beside `claim.json` under `TONARI_LOCAL_STATE_DIR`. The directory is forced to mode `0700`; the identity file and locks are created as `0600`. A pre-existing identity file with any group or other access is rejected. Unknown fields, malformed lengths, invalid keypairs, duplicate bindings, and binding replacement all fail closed. Writes use a temporary file, file sync, atomic rename, and directory sync.

This payer is only for the disposable local validator. It is not an owner wallet and must not be copied to Devnet or production. Devnet continues to use its separately supplied operator key and the public-only `show.json` session.

The real-validator test now closes and reopens both journals at two persistence boundaries: after settlement, then after accepting a claim. It verifies the same show and bindings, exact receipt recovery, the same DropToken checkpoint key, one restored claim, and final root/reveal data on chain. Its device namespace is one accepted by the browser store and its 30-second claim window includes the intentional restart latency.

R1x2 corrects a duplicate `join` identifier in the validator harness. The standard Node suite now syntax-checks all host-only integration scripts and operator tools before dispatch; 126 tests pass. Journal reopen coverage does not itself prove an actual OS process restart; Bot must still exercise that gate.
