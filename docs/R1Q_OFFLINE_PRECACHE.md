# Offline import-graph regression repair — R1q

R1p correctly added signed DropToken and persistent claims, but its three new
protocol modules were not listed in the service worker cache. A clean online load
worked; after the network was disabled and the page reloaded, `storage.mjs` could
not import `claim-store.mjs`, so all phone clients remained at preparation.
Public merge was correctly held by the host browser gate.

R1q adds `claim-store.mjs`, `drop.mjs` and `claims.mjs` to the precache and bumps
the cache namespace to v0.7.6 so existing clients install the corrected asset
set. The Node suite now parses every cached module's static relative imports and
requires the complete import graph to be explicitly cached. This turns the
observed browser failure into a CI regression rather than relying on a manual
list review. The actual browser offline reload and local-chain journey still
require the host Chrome retest before merge.

No protocol encoding, stored claim, program, deployment, key or transaction is
changed by R1q. Mandatory `OPERATING_POLICY.md` task-level security inheritance
applies. No spend, owner key, mainnet, outreach or submission authority.
