#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_ref="$(sed -n 's/^ARG UPSTREAM_API_REF=//p' "$repo_root/Dockerfile")"
[[ "$source_ref" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a pinned upstream API commit in Dockerfile.' >&2; exit 1; }
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/praesto-api-test.XXXXXXXX")"
trap 'rm -rf -- "$test_dir"' EXIT
git -C "$test_dir" init --quiet
git -C "$test_dir" remote add origin https://github.com/lejianwen/rustdesk-api.git
git -C "$test_dir" fetch --quiet --depth=1 origin "$source_ref"
git -C "$test_dir" checkout --quiet --detach FETCH_HEAD
test "$(git -C "$test_dir" rev-parse HEAD)" = "$source_ref"
git -C "$test_dir" apply "$repo_root/backend/upstream.patch"
cp "$repo_root/backend/go.mod" "$repo_root/backend/go.sum" "$test_dir/"
cp -R "$repo_root/backend/praesto" "$test_dir/"
cd "$test_dir"
export GOTOOLCHAIN=local
go mod download
go mod verify
go test -mod=readonly -race -p 3 -timeout=120s ./praesto
go build -mod=readonly -p 3 -o "$test_dir/apimain" ./cmd/apimain.go
