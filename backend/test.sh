#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/praesto-api-test.XXXXXXXX")"
trap 'rm -rf -- "$test_dir"' EXIT
cd "$repo_root/backend"
export GOTOOLCHAIN=local
go mod download
go mod verify
go test -mod=readonly -race -p 3 -timeout=120s ./praesto ./utils ./lib/jwt
go build -mod=readonly -p 3 -o "$test_dir/apimain" ./cmd/apimain.go
