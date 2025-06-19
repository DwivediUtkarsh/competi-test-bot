#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# fetch_tags.sh – Crawl every Polymarket tag page-by-page and cache to tags.json
# ---------------------------------------------------------------------------
set -euo pipefail

API_ROOT="https://gamma-api.polymarket.com/tags"
PER_PAGE=500            # observed server cap
OFFSET=0
TMP_RAW="tags_raw.json"
OUT="tags.json"

echo "[]" > "$TMP_RAW"  # start with empty array

need() { command -v "$1" >/dev/null || { echo "❌ $1 missing"; exit 1; }; }
need curl; need jq

while : ; do
  echo "📥  Fetching offset=$OFFSET …"
  batch=$(curl -s "${API_ROOT}?limit=${PER_PAGE}&offset=${OFFSET}")
  rows=$(printf '%s' "$batch" | jq 'length')
  (( rows == 0 )) && break

  # merge and de-duplicate by numeric id
  jq -s 'add | unique_by(.id)' "$TMP_RAW" <(printf '%s' "$batch") > tmp && mv tmp "$TMP_RAW"

  OFFSET=$(( OFFSET + PER_PAGE ))
  sleep 0.5   # good-citizen delay
done

echo "🛠️   Restructuring to slug-keyed object …"
jq 'reduce .[] as $t ({}; .[$t.slug] = {id:$t.id,label:$t.label,parent_id:$t.parent_id})' \
   "$TMP_RAW" > "$OUT"

TOTAL=$(jq 'length' "$OUT"); echo "✅  Saved $TOTAL unique tags to $OUT"
echo "👀  Sample:"; jq 'to_entries[0:5]' "$OUT"
rm "$TMP_RAW"
