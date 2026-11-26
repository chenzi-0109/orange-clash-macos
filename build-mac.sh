#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo ">>> [1/3] 璧嬩簣鍐呯疆 Mihomo 鍐呮牳鍙墽琛屾潈闄?.."
chmod +x resources/bin/mihomo-arm64 resources/bin/mihomo-x64

echo ">>> [2/3] 瀹夎渚濊禆骞剁紪璇?.."
npm install
npm run build

echo ">>> [3/3] 鎵撳寘 macOS DMG 瀹夎鍖?(Apple Silicon arm64 + Intel x64)..."
CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack:mac

echo ">>> 瀹屾垚锛佸畨瑁呭寘宸茬敓鎴愬湪 release/ 鐩綍锛?
ls -lh release/*.dmg
