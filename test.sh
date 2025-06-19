#!/usr/bin/env bash
set -e

BASE_URL="https://gamma-api.polymarket.com"

echo "⛳  Fetching active sports events ..."
EVENTS_JSON=$(curl -s "${BASE_URL}/events?tag_slug=sports&active=true")

# Pull array of slugs
SLUGS=$(echo "$EVENTS_JSON" | jq -r '.[].slug')

echo "🏷️  Found $(echo "$SLUGS" | wc -l) sports events"
echo "-----------------------------------------------"

for SLUG in $SLUGS; do
  echo "📌 Markets for event: $SLUG"
  curl -s "${BASE_URL}/markets?slug=${SLUG}&active=true" \
    | jq -r '.[] | [.question, .prices.yes, .prices.no] | @tsv' \
    | awk -F'\t' '{printf "  • %s | YES: %s | NO: %s\n", $1, $2, $3}'
  echo
done
