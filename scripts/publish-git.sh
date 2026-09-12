#!/usr/bin/env bash
# Only called after ci-version.py validates the release version.
set -euo pipefail
: "${WILLOW_TAG:?}" "${RELEASE_BRANCH:?}"
case "${1:-}" in
  check)
    remote_tag=$(git ls-remote --tags origin "refs/tags/$WILLOW_TAG")
    if test -n "$remote_tag"; then
      echo "Tag $WILLOW_TAG already exists; releases are never overwritten." >&2
      exit 1
    fi
    remote_head=$(git ls-remote origin "refs/heads/$RELEASE_BRANCH" | cut -f1)
    if test "$remote_head" != "$(git rev-parse HEAD)"; then
      echo 'The default branch moved since dispatch. Start a new Publish run.' >&2
      exit 1
    fi
    ;;
  commit)
    git config user.name 'github-actions[bot]'
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
    git add package.json
    if ! git diff --cached --quiet; then
      git commit -m "Release ${WILLOW_BASE_VERSION:?}"
    fi
    ;;
  push)
    git diff --exit-code HEAD
    git tag -a "$WILLOW_TAG" -m "Willow ${WILLOW_BASE_VERSION:?} (${WILLOW_VERSION:?})"
    git push --atomic origin "HEAD:refs/heads/$RELEASE_BRANCH" "refs/tags/$WILLOW_TAG"
    ;;
  *) echo 'Expected check, commit or push' >&2; exit 1 ;;
esac
