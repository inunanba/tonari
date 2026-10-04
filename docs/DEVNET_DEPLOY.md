# Devnet deployment record

The TONARI Anchor program is deployed on public Solana devnet. Devnet SOL is free test currency; no real money and no owner wallet were used.

## Program

| item | value |
|---|---|
| cluster | devnet (`https://api.devnet.solana.com`) |
| program ID | [`2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA`](https://explorer.solana.com/address/2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA?cluster=devnet) |
| loader | `BPFLoaderUpgradeab1e11111111111111111111111` |
| ProgramData | `HH8vs7ackLBXhn73jCcN8WZj6JKiLxMH9KZzYshoN8fY` |
| upgrade authority | `8k7ygJWhiRu5BrPuvHPesR7CH1QTBmNEMJvFDpRjLFWf` (devnet-only operator key; not immutable) |
| deployed | slot 507509316, 2026-10-05 06:55:37 JST |
| deploy tx | [`42ErvF5QueKydGTKG3WvCjgnAuuPLuctkjrrrFbkcjrVNdrK21NcP9Qk2V1oufPipTbQcQPw6iAihBtnsKQoh1mK`](https://explorer.solana.com/tx/42ErvF5QueKydGTKG3WvCjgnAuuPLuctkjrrrFbkcjrVNdrK21NcP9Qk2V1oufPipTbQcQPw6iAihBtnsKQoh1mK?cluster=devnet) |
| source | `main` 1d54eb6, `cargo-build-sbf --no-rustup-override --manifest-path programs/tonari/Cargo.toml -- --locked` (platform-tools v1.48, Agave 2.3.0) |
| `tonari.so` | 330080 bytes, sha256 `0784d22073bb93001560c57d03542ceeb15c43671b47faaefb2a4d8060924b58`; `solana program dump` of the deployed program has the same hash |

Reproduce the check:

```sh
solana program show 2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA -u devnet
solana program dump 2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA tonari-devnet.so -u devnet && sha256sum tonari-devnet.so
```

## Smoke transactions (operator as show authority)

Show `GxJb7U1N629zMcVEHcsggMx3qs1Wq8qfu396Aqv73ddD`, tile `iisqE7izKb16eQbNAL82yEnSocRyHUNknmLVY7NqmBW`; show authority, policy hash and tile owner were read back from the accounts and matched.

| instruction | tx |
|---|---|
| create_show | [`5Lk6gARU…`](https://explorer.solana.com/tx/5Lk6gARUZQBFbikt3m3GYNFBSYmgh3Efuq6GCG6nRXtrvkZTZGrYrbDBdtjNm8JDQ72zwFzeNqVMJRQABe1VgtD7?cluster=devnet) |
| register_ticket | [`2uMN9niy…`](https://explorer.solana.com/tx/2uMN9niyvmLvD4UXxePEFmgPXtF11pYqDB4Hjg5EwJsxi3eKYhfCB3gM6ttdjBBphYLRHpAP3XKginu2bkfht2zA?cluster=devnet) |
| issue_tile | [`4UUHwkSm…`](https://explorer.solana.com/tx/4UUHwkSmHgvDaEXWyzdCEm7oowk6VWY7v7L9LaS3W2CRc6F9T2kDb3iptTmJ8tcN7UVMfC3ZWPYCGshqTMon8UjP?cluster=devnet) |

## Two-phone exchange against devnet (host run)

`tests/swap-chain-browser.cjs` (three browser phones, offline signed exchange, reload, retry) was run once on the host against devnet instead of the local validator. Result: **PASS** — both phones reached step ④「交換が確定しました」with the same finalized devnet transaction, the third phone was unchanged, no page errors, no external requests from the pages.

| step | tx |
|---|---|
| create_show (show `BNu7bbVqMDBmCDDyKAzSwNCBFXPAajtAbYfTnmBHdNfM`) | [`4pwYL8i3…`](https://explorer.solana.com/tx/4pwYL8i36pQBcCkDJrLiqrk9q6BVJ4TmB3kYJRJ33mykQVv2wpssfNKDEt19rqu34CaKBdCp1yL7nkDHf5yxYEyu?cluster=devnet) |
| join phone (register_ticket + 3× issue_tile) | [`3RsxF1Fv…`](https://explorer.solana.com/tx/3RsxF1FvVi3gdHoiqaUsme3T7jrz2gDQDJm19CmLbktFwHTGKbdMS5ZzAQkpDz19bp7cNsh4bG2ZTkyQkWoV5Rk5?cluster=devnet), [`4YVAVMyv…`](https://explorer.solana.com/tx/4YVAVMyvsDtRE9NyLsWyz8jxbYDdJk4vsdUC8DmCmNDrBUGsJsUjBYS7HJC8ngsf3bkZPHRJCp2ihwvgxEMoYLdz?cluster=devnet), [`LhRYJPHh…`](https://explorer.solana.com/tx/LhRYJPHhahpZgXaUUnBNLMEDPaywBnX9eszFaeTEVfW1jJSyYE5nAixJdm3kUdXag48eUAwLWSW5yraFL5JY1kb?cluster=devnet) |
| settle_swap (both phones show this tx) | [`qfTeQ1Tr…`](https://explorer.solana.com/tx/qfTeQ1TryvERBEVJCsgiqSSfYusHSBGhN5cmVko4j3uZoLbFVRYd1V5zbh1hAipeFXwBHS3tvusCcAn8koVT7Zd?cluster=devnet) |

Limits, stated plainly:

- This used an **uncommitted host-only harness change**: the relay accepted the devnet RPC, used the devnet operator key as fee payer/show authority instead of a local airdrop, and labelled its config `devnet`; `apps/web/chain-api.mjs` was relaxed to accept `devnet`. The committed relay stays local-validator-only and the committed frontend still rejects devnet config. A reviewed devnet relay/frontend mode is a separate step.
- The screen text in that run still said ローカル (static UI copy).
- The relay is a trusted sponsor; the upgrade authority is a trusted devnet operator. This is a prototype record, not a production deployment.
