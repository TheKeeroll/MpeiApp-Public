#!/bin/bash
set +x
set -euo pipefail
MPEIAPP_SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$MPEIAPP_SCRIPT_DIR/environment.sh"
cd "${CI_PRIMARY_REPOSITORY_PATH:?Missing CI_PRIMARY_REPOSITORY_PATH}"
# Regenerate just before xcodebuild, including the absolute Node path for RN.
node scripts/xcode-cloud.cjs prepare
