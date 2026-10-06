# R2k — signed portable completion record

This slice closes a cryptographic evidence gap, not the cNFT gate. A device that has completed the strict six-step 18→24 judge journey signs a canonical record containing the show, policy, device public key, board digest, claims root, settlement digest, piece count and completion time. A separately trusted show authority verifies that request and co-signs the exact bytes plus the device signature.

The record is bound to the device key and cannot be reassigned without invalidating both signatures. That property is **not** the same as an on-chain non-transferable asset. The verifier therefore always returns:

- `portableRecord: VERIFIED`
- `cNFT: NOT_VERIFIED`
- `onChainAnchor: NOT_VERIFIED`
- `nonTransferability: NOT_VERIFIED`

Run the read-only verifier with an independently trusted scope and show-authority key:

```sh
node tools/verify-completion.mjs completion.json SHOW_HEX POLICY_HEX AUTHORITY_HEX
```

The CLI accepts at most 1 MiB, exact JSON `{record}`, strict lowercase fixed-width hex and exact fields. It performs no network call, mint, transaction, wallet action or key export.

## Remaining completion gate

Before submission GO, Bot must either integrate and exercise a real completion cNFT path on Devnet with public transaction/account evidence and verified non-transferability semantics, or integrate an owner-approved on-chain completion-PDA/Token-2022 fallback labelled exactly as such with a recorded score loss. This portable record can be the signed payload/digest for that action; it must never be renamed to “cNFT.”

Full submission remains NO-GO. No owner key, spend, deployment, mint, form paste or submission is authorized by this slice.
