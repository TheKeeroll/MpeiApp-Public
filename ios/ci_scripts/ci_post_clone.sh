#!/bin/bash
set +x
set -euo pipefail
MPEIAPP_SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$MPEIAPP_SCRIPT_DIR/environment.sh"
cd "${CI_PRIMARY_REPOSITORY_PATH:?Missing CI_PRIMARY_REPOSITORY_PATH}"

printf '\n[1/5] Verify source before installing tools\n'
/bin/bash "$MPEIAPP_SCRIPT_DIR/verify-source.sh"

printf '\n[2/5] Node 24 and committed release metadata\n'
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]]; then brew install node@24; fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { printf 'Node 24 is required.\n' >&2; exit 1; }
node scripts/xcode-cloud.cjs preflight

printf '\n[3/5] Ruby and frozen Bundler dependencies\n'
if ! command -v ruby >/dev/null || [[ "$(ruby -e 'print RUBY_VERSION.split(".")[0, 2].join(".")')" != 3.3 ]]; then brew install ruby@3.3; fi
[[ "$(ruby -e 'print RUBY_VERSION.split(".")[0, 2].join(".")')" == 3.3 ]] || { printf 'Ruby 3.3 is required.\n' >&2; exit 1; }
MPEIAPP_BUNDLER_VERSION=$(awk '/^BUNDLED WITH/ {getline; gsub(/^[ \t]+|[ \t\r]+$/, ""); print; exit}' Gemfile.lock)
[[ "$MPEIAPP_BUNDLER_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { printf 'Gemfile.lock has no Bundler version.\n' >&2; exit 1; }
if ! gem list --installed bundler --version "$MPEIAPP_BUNDLER_VERSION" >/dev/null; then
  gem install bundler --version "$MPEIAPP_BUNDLER_VERSION" --no-document
fi
export BUNDLE_GEMFILE="$PWD/Gemfile" BUNDLE_FROZEN=true BUNDLE_PATH="$HOME/.mpeiapp-cloud/bundle"
bundle "_${MPEIAPP_BUNDLER_VERSION}_" install

printf '\n[4/5] Yarn dependencies and native patches\n'
if ! command -v yarn >/dev/null || [[ "$(yarn --version)" != 1.22.22 ]]; then
  npm install --global --prefix "$HOME/.mpeiapp-cloud/node" yarn@1.22.22
fi
export PATH="$HOME/.mpeiapp-cloud/node/bin:$PATH"
yarn install --frozen-lockfile --non-interactive --production=false
node scripts/xcode-cloud.cjs prepare

printf '\n[5/5] Install committed Pods\n'
cd ios
bundle "_${MPEIAPP_BUNDLER_VERSION}_" exec pod install --deployment
printf '[OK] Cloud dependencies and client configuration ready.\n'
