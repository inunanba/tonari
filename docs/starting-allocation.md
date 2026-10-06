# Starting-piece fairness

TONARI's three-device demo assigns three normal picture pieces after the device has created its non-extractable Ed25519 identity.

- The seed is the canonical show id plus the device public key. SHA-256 makes the result reproducible for an audit without exposing or exporting the private key.
- Every draw uses rejection sampling over 24 positions, so each normal piece has exactly the same probability. There is no paid chance and no complete-gacha mechanic.
- The first draw is intentionally shared by every device in the same show. This guarantees a visible duplicate in circulation and gives neighbours a reason to exchange. The remaining two draws are device-bound and unique within that device's initial set.
- Initial allocation never labels or awards a rare piece. Rare placement remains controlled by the existing crowd-aware allocator, caps and governor.
- A device gets three starting positions, not three claims of final chain ownership. The screen continues to distinguish provisional exchange state from finalized ownership.

The deterministic implementation is `packages/protocol/picture-board.mjs`; distribution, repeatability and duplicate invariants are covered by `tests/picture-board.test.mjs`.
