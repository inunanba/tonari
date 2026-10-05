# R1w — claim finality-lag repair

The participant eligibility clock remains `processed`, while chain writes use
an explicit `finalized` clock. Window creation adds the measured non-negative
processed/finalized lag to the configured safety lead, so `validFrom` remains
in the future after the commit reaches finality.

Root and reveal readiness are gated by that finalized clock, and the real
validator harness waits on the same commitment before sending either action.
This prevents a processed boundary from racing a lagging finalized preflight.

The participant page preserves successful submit/replay text across refresh.
A device with no currently missing tiles enters a waiting state and refreshes
automatically instead of failing with `NO_MISSING_TILES`.

Node coverage includes a deterministic 12-second lag. Host Cargo, SBF, local
validator, and actual Chrome proof remain delegated.
