#!/usr/bin/env bash
# deploy-dev.sh — Build dev branch and push to master's public/dev/
# Run from the repo root on the dev branch.
set -e

if [ "$(git branch --show-current)" != "dev" ]; then
  echo "ERROR: must be on dev branch" && exit 1
fi

# Confirm vite.config has /dev/ base
if ! grep -q "base: '/dev/'" vite.config.js; then
  echo "ERROR: vite.config.js must have base: '/dev/' on dev branch" && exit 1
fi

npm run build

git checkout master
# rsync excludes the nested dev/ folder Vite copies from public/
rsync -a --delete --exclude='dev/' dist/ public/dev/
git add public/dev/
git commit -m "dev: update /dev build"
git push
npx vercel deploy --prod --yes
git checkout dev
