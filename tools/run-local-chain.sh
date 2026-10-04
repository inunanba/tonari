#!/usr/bin/env bash
# Test-only: fresh temporary local ledger and ephemeral keys. No wallet file is read.
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --ignore-scripts
npm test
cargo test --workspace --lib --locked -j 1
if [[ -n "${TONARI_SBF_RUST_BIN:-}" ]]; then export PATH="$TONARI_SBF_RUST_BIN:$PATH"; fi
if ! rustc --print target-list | rg '^sbpf-solana-solana$' >/dev/null; then
  echo 'Set TONARI_SBF_RUST_BIN to the Agave platform-tools1.48 rust/bin directory.' >&2
  exit 1
fi
cargo-build-sbf --no-rustup-override --manifest-path programs/tonari/Cargo.toml -j 1 -- --locked
cargo-build-sbf --no-rustup-override --manifest-path programs/cpi-probe/Cargo.toml -j 1 -- --locked
tonari_test_ledger=$(mktemp -d -t tonari-local-ledger.XXXXXX)
tonari_rpc_port=${TONARI_LOCAL_PORT:-18999}
[[ "$tonari_rpc_port" =~ ^[0-9]+$ ]] && ((tonari_rpc_port>=1024 && tonari_rpc_port<=65000))
solana-test-validator --reset --quiet --ledger "$tonari_test_ledger" --rpc-port "$tonari_rpc_port" \
  --bpf-program 2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA target/deploy/tonari.so \
  --bpf-program cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN target/deploy/tonari_cpi_probe.so \
  > "$tonari_test_ledger/start.log" 2>&1 &
tonari_validator_pid=$!
trap 'kill "$tonari_validator_pid" 2>/dev/null || true' EXIT
export TONARI_LOCAL_RPC="http://127.0.0.1:$tonari_rpc_port"
node --input-type=module - <<'JS'
let ready=false;
for(let i=0;i<30;i++){
 try{const j=await(await fetch(process.env.TONARI_LOCAL_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getVersion'})})).json();if(j.result){console.log('LOCAL_RPC_READY',j.result);ready=true;break;}}catch{}
 await new Promise(r=>setTimeout(r,1000));
}
if(!ready)throw Error('LOCAL_RPC_NOT_READY');
JS
kill -0 "$tonari_validator_pid"
node tests/chain-validator.cjs
node tests/relay-validator.mjs
if [[ "${TONARI_CHAIN_BROWSER:-0}" == "1" ]]; then
  node tools/serve-chain.mjs > "$tonari_test_ledger/relay.log" 2>&1 &
  tonari_relay_pid=$!
  trap 'kill "$tonari_relay_pid" "$tonari_validator_pid" 2>/dev/null || true' EXIT
  node tests/swap-chain-browser.cjs
fi
