# Three-tier chance for a not-yet-owned piece

This is the current R2p product policy. There is no rare or special piece class.
Every successful spot attempt can return only one of the 24 pieces the device
does not yet own. Neighbour swapping remains the main collection path.

| Context | Chance per eligible read | Meaning |
|---|---:|---|
| Own seat or current line | 30,000 ppm (3%) | Nonzero progress without moving |
| Crowded area | 10,000 ppm (1%) | Do not add pull to an already busy place |
| Quiet area | 180,000 ppm (18%) | Highest tier for people who choose faster collection |

These are transparent prototype parameters, not calibrated venue results. The
operator may lower or stop distribution. A spot closes when its per-window cap
is reached; every spot closes at the total cap. Closed or stopped means exactly
zero. Existing monotone-window recovery and governor warnings remain separate
safety layers, so lowering is faster than reopening.

`tiered-chance.mjs` derives the announced spot from the current simulated crowd
classification and open caps. Its draw is deterministic for the same show seed,
ticket, frame and spot. SHA-256 rejection sampling avoids modulo bias for both
the million-part roll and the choice among missing IDs. Duplicate, malformed or
complete ownership sets fail closed.

The operations screen uses a **simulated crowd input**. Reading venue cameras
and automatically classifying movement is only a roadmap use; it is not present
in this build and no physical-safety or crowd-reduction outcome is claimed.

There is no purchase, prize, coupon, paid chance or complete-gacha mechanic.
