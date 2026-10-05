# R1r claim-window anchor

The Anchor program source now has a separate `ClaimWindow` PDA. This leaves the
deployed swap settlement instruction and existing `Show` account layout intact.

The show authority commits, before a window starts, to the checkpoint public
key, probability, cap, time bounds, and a domain-separated entropy hash. After
the window closes it may post exactly one nonzero claims root whose count cannot
exceed the committed cap. After the committed reveal time it may disclose the
exact secret; the program hashes show, policy, window number, and secret before
accepting it. Root replacement and repeat reveal both fail.

Each signed DropToken nonce is derived from that secret plus show, policy,
window, and frame. The browser-side verifier checks both the on-chain commitment
and the per-frame nonce after reveal, so an operator cannot attach an unrelated
secret to tokens it issued earlier.

The root is an authority-posted audit anchor. The program does not receive every
device signature and therefore does not prove that the submitted log is
complete or that every claim was eligible. Independent verification still needs
the signed DropTokens, the complete per-ticket logs, and Merkle proofs from R1o
and R1p.

`tests/chain-validator.cjs` contains local-validator acceptance and rollback
checks for early root posting, cap overflow, root replacement, wrong reveal, and
repeat reveal. Work cannot run Cargo or a validator in its current environment;
the source must not be presented as deployed until the host builds it and those
validator cases pass. No Devnet upgrade is authorized by this round.
