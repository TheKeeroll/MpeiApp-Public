#!/bin/bash
set +x
set -euo pipefail

fail() { printf '[Xcode Cloud] %s\n' "$1" >&2; exit 1; }
case "${CI_XCODE_CLOUD:-}" in TRUE|true) ;; *) fail 'Run this script in Xcode Cloud.' ;; esac
cd "${CI_PRIMARY_REPOSITORY_PATH:?Missing CI_PRIMARY_REPOSITORY_PATH}"
case "${CI_START_CONDITION:-}" in push|manual|manual_rebuild) ;; *) fail 'Only branch/tag pushes or manual onboarding/rebuilds are allowed.' ;; esac
[[ "${CI_COMMIT:-}" =~ ^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$ ]] || fail 'CI_COMMIT is invalid.'
[[ "$(git rev-parse HEAD)" == "$CI_COMMIT" ]] || fail 'Checkout does not match CI_COMMIT.'

if [[ -n "${CI_TAG:-}" ]]; then
  case "$CI_TAG" in ios-dev-?*) ;; *) fail 'The dev tag must start with ios-dev- and have a suffix.' ;; esac
  git check-ref-format "refs/tags/$CI_TAG" >/dev/null 2>&1 || fail 'CI_TAG is invalid.'
  branch=dev
elif [[ "${CI_BRANCH:-}" == v2 ]]; then
  branch=v2
elif [[ "${CI_BRANCH:-}" == dev && "${CI_START_CONDITION:-}" == manual* ]]; then
  # Xcode's first-run wizard starts a branch build before tag automation exists.
  branch=dev
else
  fail 'A regular dev push must not start Cloud; use an ios-dev- tag.'
fi

refspec="+refs/heads/$branch:refs/remotes/origin/$branch"
if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
  # The usual tag/push points at the branch tip: do not download asset history.
  git fetch --quiet --no-tags --depth=1 origin "$refspec" >/dev/null 2>&1 || fail 'Cannot fetch branch tip; check repository access.'
else
  git fetch --quiet --no-tags origin "$refspec" >/dev/null 2>&1 || fail 'Cannot fetch branch history; check repository access.'
fi
if [[ "$(git rev-parse "refs/remotes/origin/$branch")" != "$CI_COMMIT" && "$(git rev-parse --is-shallow-repository)" == true ]]; then
  git fetch --quiet --no-tags --unshallow origin "$refspec" >/dev/null 2>&1 || fail 'Cannot fetch full branch history; check repository access.'
fi
git merge-base --is-ancestor "$CI_COMMIT" "refs/remotes/origin/$branch" || fail 'The commit is not in the required remote branch history.'

if [[ -n "${CI_TAG:-}" ]]; then
  git fetch --quiet --no-tags origin "refs/tags/$CI_TAG:refs/tags/$CI_TAG" >/dev/null 2>&1 || fail 'Cannot fetch the published dev tag.'
  [[ "$(git rev-parse "refs/tags/$CI_TAG^{commit}")" == "$CI_COMMIT" ]] || fail 'The published tag does not point to CI_COMMIT.'
fi
printf '[OK] Source commit and %s history verified.\n' "$branch"
