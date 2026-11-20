#!/bin/sh
# 部署到 GitHub Pages：先執行 node build.js，再把 dist/ 推送到 gh-pages 分支。
# 用法：sh deploy-github-pages.sh
set -e
cd "$(dirname "$0")"
node build.js
REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "部署 $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "✓ 已推送到 gh-pages 分支，GitHub Pages 約一至兩分鐘後更新。"
