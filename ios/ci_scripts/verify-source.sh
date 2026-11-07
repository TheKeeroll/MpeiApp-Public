#!/bin/bash
# Advisory only: workflow start conditions control builds and distribution.
# Inspect the existing checkout without network requests or history downloads.
set +x
set +e
set +u
set +o pipefail

warn() { printf 'warning: [Xcode Cloud source] %s\n' "$1" >&2; }

inspect_source() {
  case "${CI_XCODE_CLOUD:-}" in
    TRUE|true) ;;
    *) warn 'CI_XCODE_CLOUD is not set; continuing with source diagnostics only.' ;;
  esac
  if [[ -z "${CI_PRIMARY_REPOSITORY_PATH:-}" ]] || ! cd "$CI_PRIMARY_REPOSITORY_PATH" 2>/dev/null; then
    warn 'Repository path is missing or unavailable; skipping source checks.'
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then
    warn 'Git is unavailable; skipping source checks.'
    return 0
  fi
  local head tag_commit branch_tip
  if ! head=$(git rev-parse --verify HEAD 2>/dev/null); then
    warn 'Cannot read checkout HEAD; skipping source checks.'
    return 0
  fi

  case "${CI_START_CONDITION:-}" in
    push|manual|manual_rebuild) ;;
    *) warn 'Unexpected or missing start condition; the workflow will continue.' ;;
  esac
  if [[ ! "${CI_COMMIT:-}" =~ ^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$ ]]; then
    warn 'CI_COMMIT is missing or malformed; the workflow will continue.'
  elif [[ "$head" != "$CI_COMMIT" ]]; then
    warn 'Checkout HEAD differs from CI_COMMIT; the workflow will continue.'
  fi

  if [[ -n "${CI_TAG:-}" ]]; then
    case "$CI_TAG" in
      release-?*) printf '[Xcode Cloud source] Release tag; App Store delivery is controlled by the workflow.\n' ;;
      testflight-?*) printf '[Xcode Cloud source] TestFlight tag; external testing is controlled by the workflow.\n' ;;
      ios-dev-?*) printf '[Xcode Cloud source] Legacy ios-dev tag; delivery is controlled by the workflow.\n' ;;
      *) warn 'Unexpected tag format; expected release-* or testflight-* (legacy ios-dev-* is also recognized). The workflow will continue.' ;;
    esac
    if ! git check-ref-format "refs/tags/$CI_TAG" >/dev/null 2>&1; then
      warn 'CI_TAG is not a valid Git tag name; skipping tag lookup.'
    elif ! tag_commit=$(git rev-parse --verify "refs/tags/$CI_TAG^{commit}" 2>/dev/null); then
      warn 'Tag ref is not available locally; skipping comparison without fetching.'
    elif [[ "$tag_commit" != "$head" ]]; then
      warn 'The local tag points to a different commit than HEAD; the workflow will continue.'
    fi
  fi

  if [[ -n "${CI_BRANCH:-}" ]]; then
    case "$CI_BRANCH" in
      dev|v2) ;;
      *) warn 'Build is on a branch other than dev/v2; the workflow will continue.' ;;
    esac
    if ! git check-ref-format "refs/heads/$CI_BRANCH" >/dev/null 2>&1; then
      warn 'CI_BRANCH is not a valid Git branch name; skipping history comparison.'
    elif ! branch_tip=$(git rev-parse --verify "refs/remotes/origin/$CI_BRANCH^{commit}" 2>/dev/null); then
      warn 'Remote branch ref is not available locally; skipping history comparison without fetching.'
    elif ! git merge-base --is-ancestor "$head" "$branch_tip" >/dev/null 2>&1; then
      warn 'Branch ancestry is not confirmed by local history (which may be shallow); the workflow will continue.'
    fi
  elif [[ -z "${CI_TAG:-}" ]]; then
    warn 'Neither CI_BRANCH nor CI_TAG is set; the workflow will continue.'
  fi
  printf '[Xcode Cloud source] Advisory checks finished; build and distribution may proceed.\n'
}

inspect_source
# No diagnostic result may prevent archiving or App Store Connect delivery.
exit 0
