#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"
node scripts/compile.mjs
mkdir -p dist/server dist/.openai
cp worker/index.js dist/server/index.js
# Production identity is optional, checkout-local configuration and is never committed.
if [[ -f .openai/hosting.json ]]; then
  cp .openai/hosting.json dist/.openai/hosting.json
else
  node --input-type=module -e 'import fs from "node:fs"; fs.writeFileSync("dist/.openai/hosting.json", JSON.stringify({ d1: null, r2: null })+"\n");'
fi
echo "Built $project_root/dist"
