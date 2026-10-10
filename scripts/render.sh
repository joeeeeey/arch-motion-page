#!/usr/bin/env bash
# Render a built amp page with HyperFrames, entirely inside Docker (never npx on the host).
#
#   scripts/render.sh <out-dir> [--check-only] [--output renders/page.mp4] [--fps 30] [--quality looks] [--format mp4]
#
# - Builds a local image once (node 22 + ffmpeg + HyperFrames + its headless Chrome); HF_VERSION pins the CLI.
# - Runs lint and check, then render, with --network none and only <out-dir> mounted.
# - Video lands in <out-dir>/renders/ unless --output says otherwise (paths are relative to <out-dir>).
# - Apple Silicon: runs linux/amd64 under emulation by default (HyperFrames' bundled Chrome is x64);
#   override with AMP_PLATFORM=linux/arm64 if your HyperFrames version supports it.
set -euo pipefail

[ $# -ge 1 ] || { sed -n '2,4p' "$0"; exit 2; }
OUT=$(cd "$1" && pwd); shift
[ -f "$OUT/index.html" ] || { echo "no index.html in $OUT; run scripts/build.mjs first" >&2; exit 1; }

CHECK_ONLY=0
OUTPUT=""
RENDER_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --output|-o) OUTPUT="$2"; shift ;;
    *) RENDER_ARGS+=("$1") ;;
  esac
  shift
done
[ -n "$OUTPUT" ] || OUTPUT="renders/$(node -e 'console.log(require(process.argv[1]).id)' "$OUT/amp-build.json").mp4"

HF_VERSION=${HF_VERSION:-0.8.145}
PLATFORM=${AMP_PLATFORM:-linux/amd64}
IMAGE="amp-hyperframes:${HF_VERSION}-${PLATFORM##*/}"
HF_ENV="HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_SKIP_SKILLS=1"

BASE=node:22-bookworm-slim

# One-time image via `docker run` + `docker commit`, not `docker build`, and the public base is pulled
# with an empty DOCKER_CONFIG: a desktop credential helper can block forever on a keychain prompt.
pull_anon() {
  docker image inspect "$1" >/dev/null 2>&1 && return 0
  local cfg host
  cfg=$(mktemp -d); echo '{}' > "$cfg/config.json"
  host=$(docker context inspect --format '{{.Endpoints.docker.Host}}')
  DOCKER_CONFIG=$cfg DOCKER_HOST=$host docker pull --platform "$PLATFORM" "$1" || { rm -rf "$cfg"; return 1; }
  rm -rf "$cfg"
}
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "creating $IMAGE (one-time)" >&2
  pull_anon "$BASE"
  NAME="amp-hf-build-$$"
  trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
  docker run --platform "$PLATFORM" --name "$NAME" "$BASE" sh -euc "
    apt-get -o Acquire::Retries=5 update && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      ffmpeg ca-certificates unzip fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libgbm1 libgtk-3-0 libxcomposite1 libxdamage1 libxrandr2 libxkbcommon0 libpango-1.0-0 libcairo2 \
      libasound2 libxshmfence1
    rm -rf /var/lib/apt/lists/*
    export $HF_ENV
    npm install -g hyperframes@${HF_VERSION} && hyperframes browser ensure && hyperframes --version"
  docker commit -c "ENV $HF_ENV" -c 'WORKDIR /work' "$NAME" "$IMAGE" >/dev/null
  docker rm "$NAME" >/dev/null
  trap - EXIT
fi

RUN=(docker run --rm --platform "$PLATFORM" --network none --shm-size 1g
  -e PRODUCER_LOW_MEMORY_MODE="${PRODUCER_LOW_MEMORY_MODE:-1}"
  -v "$OUT":/work -w /work "$IMAGE")

"${RUN[@]}" sh -c 'hyperframes lint . && hyperframes check .'
[ "$CHECK_ONLY" = 1 ] && { echo "lint + check passed"; exit 0; }
"${RUN[@]}" hyperframes render --output "$OUTPUT" ${RENDER_ARGS[@]+"${RENDER_ARGS[@]}"}
echo "rendered -> $OUT/$OUTPUT"
