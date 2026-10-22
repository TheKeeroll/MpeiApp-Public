#!/bin/bash
# Sourced by every hook: exports in post-clone do not set xcodebuild's PATH.
set +x
set -euo pipefail
case "${CI_XCODE_CLOUD:-}" in TRUE|true) ;; *) printf '[Xcode Cloud] Not a Cloud checkout.\n' >&2; exit 1 ;; esac
export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
MPEIAPP_BREW_PREFIX=$(brew --prefix)
export PATH="$MPEIAPP_BREW_PREFIX/opt/node@24/bin:$MPEIAPP_BREW_PREFIX/opt/ruby@3.3/bin:$PATH"
export GEM_HOME="$HOME/.mpeiapp-cloud/gems"
export PATH="$HOME/.mpeiapp-cloud/node/bin:$GEM_HOME/bin:$PATH"
export RCT_NO_LAUNCH_PACKAGER=1
umask 077
