#!/bin/bash
set +x
set -euo pipefail
MPEIAPP_SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$MPEIAPP_SCRIPT_DIR/environment.sh"
cd "${CI_PRIMARY_REPOSITORY_PATH:?Missing CI_PRIMARY_REPOSITORY_PATH}"
if [[ "${CI_XCODEBUILD_EXIT_CODE:-1}" != 0 ]]; then
  printf '[Xcode Cloud] xcodebuild failed; see the action logs.\n'
  exit 0
fi
if [[ "${CI_XCODEBUILD_ACTION:-}" == archive ]]; then
  node scripts/xcode-cloud.cjs verify-archive
fi
