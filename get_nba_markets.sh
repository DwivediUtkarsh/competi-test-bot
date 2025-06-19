#!/bin/bash

# NBA Markets Fetcher Script
# Replicates the logic from the Discord bot to fetch and display NBA markets
# Based on: discord_bot/commands/markets/helpers/polymarket_api.py

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# API Configuration (same as the Discord bot)
GAMMA_HOST="${GAMMA_HOST:-https://gamma-api.polymarket.com}"
NBA_TAG_ID=745 # From config.AVAILABLE_TAGS["NBA"]
LIMIT=1000
MAX_ATTEMPTS=2

# Special NBA Finals markets (same as Discord bot)
SPECIAL_CONDITION_IDS=(
    "0x6edc6c77c16ef3ba1bcd646159f12f8b8a39528e500dcff95b9220ccfbb75141"  # OKC Thunder NBA Finals
    "0xf2a89afeddff5315e37211b0b0e4e93ed167fba2694cd35c252672d0aca73711"   # Second special market
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emojis (same as Discord bot config)
NBA_EMOJI_TEAM1="🏀"
NBA_EMOJI_TEAM2="⚔️"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

# Check if required tools are available
check_dependencies() {
    local deps=("curl" "jq" "date")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency '$dep' is not installed."
            exit 1
        fi
    done
}

# Convert decimal probability to American odds (same logic as Discord bot)
decimal_to_american() {
    local probability="$1"
    
    # Use bc for floating point arithmetic
    if (( $(echo "$probability > 0.5" | bc -l) )); then
        # Negative odds for favorites
        local division=$(echo "scale=2; $probability / (1 - $probability)" | bc -l)
        local american_odds=$(echo "scale=0; -100 * $division / 1" | bc -l)
        echo "${american_odds}"
    else
        # Positive odds for underdogs
        local division=$(echo "scale=2; (1 - $probability) / $probability" | bc -l)
        local american_odds=$(echo "scale=0; 100 * $division / 1" | bc -l)
        echo "+${american_odds}"
    fi
}

# Calculate European odds from share price
calculate_european_odds() {
    local share_price="$1"
    if (( $(echo "$share_price == 0" | bc -l) )); then
        echo "∞"
    else
        echo "scale=2; 1 / $share_price" | bc -l
    fi
}

# Check if a game start time is in the future (NBA uses 24h lookback)
is_future_game() {
    local game_start_time="$1"
    local now_minus_24h=$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%SZ')
    
    # Convert both dates to epoch for comparison
    local game_epoch=$(date -d "$game_start_time" +%s 2>/dev/null || echo 0)
    local threshold_epoch=$(date -d "$now_minus_24h" +%s)
    
    if [ "$game_epoch" -gt "$threshold_epoch" ]; then
        return 0  # true
    else
        return 1  # false
    fi
}

# Check if condition ID is a special NBA Finals market
is_special_market() {
    local condition_id="$1"
    for special_id in "${SPECIAL_CONDITION_IDS[@]}"; do
        if [ "$condition_id" = "$special_id" ]; then
            return 0  # true
        fi
    done
    return 1  # false
}

# Format game time to EST (same as Discord bot)
format_game_time() {
    local game_start_time="$1"
    
    # Convert UTC to EST and format
    if command -v gdate &> /dev/null; then
        # macOS with GNU date
        gdate -d "$game_start_time" -u '+%Y-%m-%d %I:%M %p EST' 2>/dev/null || echo "Invalid Date"
    else
        # Linux date
        date -d "$game_start_time" -u '+%Y-%m-%d %I:%M %p EST' 2>/dev/null || echo "Invalid Date"
    fi
}

# ============================================================================
# API FUNCTIONS
# ============================================================================

# Fetch markets from Gamma API (same logic as Discord bot)
fetch_markets_from_api() {
    local offset="${1:-0}"
    local attempt=0
    
    log "Fetching NBA markets from API (offset: $offset)..."
    
    while [ $attempt -lt $MAX_ATTEMPTS ]; do
        attempt=$((attempt + 1))
        
        local url="${GAMMA_HOST}/markets"
        local params="tag_id=${NBA_TAG_ID}&closed=false&active=true&archived=false&limit=${LIMIT}&offset=${offset}"
        local full_url="${url}?${params}"
        
        log "Request attempt $attempt/$MAX_ATTEMPTS: $full_url"
        
        # Make the API request
        local response
        if response=$(curl -s -w "%{http_code}" "$full_url" 2>/dev/null); then
            local http_code="${response: -3}"
            local body="${response%???}"
            
            if [ "$http_code" = "200" ]; then
                # Validate JSON
                if echo "$body" | jq empty 2>/dev/null; then
                    local count=$(echo "$body" | jq '. | length')
                    success "Received $count markets from API"
                    echo "$body"
                    return 0
                else
                    error "Invalid JSON response from API"
                fi
            else
                error "HTTP error $http_code from API"
            fi
        else
            error "Failed to connect to API"
        fi
        
        if [ $attempt -lt $MAX_ATTEMPTS ]; then
            warning "Retrying in 2 seconds..."
            sleep 2
        fi
    done
    
    error "Failed to fetch markets after $MAX_ATTEMPTS attempts"
    return 1
}

# ============================================================================
# FILTERING FUNCTIONS (Same logic as Discord bot)
# ============================================================================

# Filter markets for future NBA games (replicates filter_future_markets_nba)
filter_future_markets() {
    local markets_json="$1"
    
    log "Filtering markets for future NBA games..."
    
    # Create filtered array
    local filtered_markets="[]"
    local total_count=$(echo "$markets_json" | jq '. | length')
    local included_count=0
    
    # Process each market
    for i in $(seq 0 $((total_count - 1))); do
        local market=$(echo "$markets_json" | jq ".[$i]")
        local market_id=$(echo "$market" | jq -r '.id // "N/A"')
        local condition_id=$(echo "$market" | jq -r '.conditionId // "N/A"')
        local game_start_time=$(echo "$market" | jq -r '.gameStartTime // ""')
        local spread=$(echo "$market" | jq -r '.spread // 0')
        
        # Check if it's a special NBA Finals market
        if is_special_market "$condition_id"; then
            log "✅ Including special NBA Finals market $market_id (conditionId: $condition_id)"
            filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
            included_count=$((included_count + 1))
            continue
        fi
        
        # Check regular game criteria: spread <= 0.05 AND future game time
        if [ -n "$game_start_time" ] && [ "$game_start_time" != "null" ]; then
            local spread_ok=$(echo "$spread <= 0.05" | bc -l)
            if [ "$spread_ok" = "1" ] && is_future_game "$game_start_time"; then
                filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
                included_count=$((included_count + 1))
            fi
        fi
    done
    
    success "Filtered to $included_count future NBA markets"
    echo "$filtered_markets"
}

# Filter for exactly 2 outcomes (replicates filter_correct_markets)
filter_correct_markets() {
    local markets_json="$1"
    
    log "Filtering markets with exactly 2 outcomes..."
    
    local filtered_markets="[]"
    local total_count=$(echo "$markets_json" | jq '. | length')
    local included_count=0
    
    for i in $(seq 0 $((total_count - 1))); do
        local market=$(echo "$markets_json" | jq ".[$i]")
        local market_id=$(echo "$market" | jq -r '.id // "N/A"')
        local condition_id=$(echo "$market" | jq -r '.conditionId // "N/A"')
        local outcomes=$(echo "$market" | jq -r '.outcomes // "[]"')
        
        # Special markets are always included
        if is_special_market "$condition_id"; then
            log "✅ Including special NBA Finals market $market_id (bypassing outcome check)"
            filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
            included_count=$((included_count + 1))
            continue
        fi
        
        # Check for exactly 2 outcomes
        local outcomes_array
        if outcomes_array=$(echo "$outcomes" | jq . 2>/dev/null); then
            local outcome_count=$(echo "$outcomes_array" | jq '. | length')
            if [ "$outcome_count" = "2" ]; then
                filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
                included_count=$((included_count + 1))
            fi
        fi
    done
    
    success "Found $included_count markets with exactly 2 outcomes"
    echo "$filtered_markets"
}

# Filter NBA markets by type (moneyline, over/under, spread)
filter_nba_markets_by_type() {
    local markets_json="$1"
    local market_type="$2"  # "moneyline", "overunder", "spread"
    
    log "Filtering NBA markets for type: $market_type"
    
    local filtered_markets="[]"
    local total_count=$(echo "$markets_json" | jq '. | length')
    local included_count=0
    
    for i in $(seq 0 $((total_count - 1))); do
        local market=$(echo "$markets_json" | jq ".[$i]")
        local market_id=$(echo "$market" | jq -r '.id // "N/A"')
        local condition_id=$(echo "$market" | jq -r '.conditionId // "N/A"')
        local sports_market_type=$(echo "$market" | jq -r '.sportsMarketType // ""')
        local spread=$(echo "$market" | jq -r '.spread // 0')
        local outcomes=$(echo "$market" | jq -r '.outcomes // "[]"')
        
        # Special markets are always included for moneyline
        if is_special_market "$condition_id" && [ "$market_type" = "moneyline" ]; then
            filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
            included_count=$((included_count + 1))
            continue
        fi
        
        case "$market_type" in
            "moneyline")
                # Not spreads or totals, and exactly 2 outcomes
                if [ "$sports_market_type" != "spreads" ] && [ "$sports_market_type" != "totals" ]; then
                    local outcomes_array
                    if outcomes_array=$(echo "$outcomes" | jq . 2>/dev/null); then
                        local outcome_count=$(echo "$outcomes_array" | jq '. | length')
                        if [ "$outcome_count" = "2" ]; then
                            filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
                            included_count=$((included_count + 1))
                        fi
                    fi
                fi
                ;;
            "overunder")
                # sportsMarketType == "totals" and spread <= 0.05
                if [ "$sports_market_type" = "totals" ]; then
                    local spread_ok=$(echo "$spread <= 0.05" | bc -l)
                    if [ "$spread_ok" = "1" ]; then
                        filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
                        included_count=$((included_count + 1))
                    fi
                fi
                ;;
            "spread")
                # sportsMarketType == "spreads" and spread <= 0.05
                if [ "$sports_market_type" = "spreads" ]; then
                    local spread_ok=$(echo "$spread <= 0.05" | bc -l)
                    if [ "$spread_ok" = "1" ]; then
                        filtered_markets=$(echo "$filtered_markets" | jq ". += [$market]")
                        included_count=$((included_count + 1))
                    fi
                fi
                ;;
        esac
    done
    
    success "Found $included_count NBA $market_type markets"
    echo "$filtered_markets"
}

# ============================================================================
# DISPLAY FUNCTIONS
# ============================================================================

# Create market display string (replicates create_market_string)
format_market_display() {
    local market="$1"
    
    local market_id=$(echo "$market" | jq -r '.id // "N/A"')
    local question=$(echo "$market" | jq -r '.question // "Unknown Question"')
    local outcomes=$(echo "$market" | jq -r '.outcomes // "[]"')
    local outcome_prices=$(echo "$market" | jq -r '.outcomePrices // "[]"')
    local game_start_time=$(echo "$market" | jq -r '.gameStartTime // "N/A"')
    local sports_market_type=$(echo "$market" | jq -r '.sportsMarketType // ""')
    local line=$(echo "$market" | jq -r '.line // "N/A"')
    
    # Parse outcomes and prices
    local outcomes_array
    local outcome_prices_array
    if ! outcomes_array=$(echo "$outcomes" | jq . 2>/dev/null) || \
       ! outcome_prices_array=$(echo "$outcome_prices" | jq . 2>/dev/null); then
        echo "**Error: Market $market_id data incomplete**"
        return
    fi
    
    local outcome_count=$(echo "$outcomes_array" | jq '. | length')
    local price_count=$(echo "$outcome_prices_array" | jq '. | length')
    
    if [ "$outcome_count" -lt 2 ] || [ "$price_count" -lt 2 ]; then
        echo "**Error: Market $market_id data incomplete**"
        return
    fi
    
    # Get team names and prices
    local team1_name=$(echo "$outcomes_array" | jq -r '.[0]')
    local team2_name=$(echo "$outcomes_array" | jq -r '.[1]')
    local team1_price=$(echo "$outcome_prices_array" | jq -r '.[0]')
    local team2_price=$(echo "$outcome_prices_array" | jq -r '.[1]')
    
    # Calculate odds
    local team1_american=$(decimal_to_american "$team1_price")
    local team2_american=$(decimal_to_american "$team2_price")
    local team1_european=$(calculate_european_odds "$team1_price")
    local team2_european=$(calculate_european_odds "$team2_price")
    
    # Format game time
    local formatted_time="N/A"
    local future_warning=""
    if [ "$game_start_time" != "N/A" ] && [ "$game_start_time" != "null" ]; then
        formatted_time=$(format_game_time "$game_start_time")
        
        # Check if game is more than 24 hours in the future
        local now_epoch=$(date +%s)
        local game_epoch=$(date -d "$game_start_time" +%s 2>/dev/null || echo 0)
        local diff=$((game_epoch - now_epoch))
        if [ "$diff" -gt 86400 ]; then  # 24 hours = 86400 seconds
            future_warning=" ⚠️ Game in 24hrs+"
        fi
    fi
    
    # Create formatted output based on market type
    echo ""
    echo "$(printf '=%.0s' {1..60})"
    echo -e " 🗓️  ${WHITE}${question}${NC} (${formatted_time}${future_warning})"
    echo ""
    echo -e " ${NBA_EMOJI_TEAM1} ${WHITE}${team1_name}:${NC}     ${YELLOW}${team1_american}${NC} (EU: ${CYAN}${team1_european}${NC})"
    echo -e " ${NBA_EMOJI_TEAM2} ${WHITE}${team2_name}:${NC}     ${YELLOW}${team2_american}${NC} (EU: ${CYAN}${team2_european}${NC})"
    
    # Add line information for spread/totals
    case "$sports_market_type" in
        "totals")
            echo -e " 📊 ${WHITE}Total Line:${NC} ${line} points"
            ;;
        "spreads")
            echo -e " 📏 ${WHITE}Point Spread:${NC} ${line} points"
            ;;
    esac
    
    echo "$(printf '=%.0s' {1..60})"
}

# Display markets with pagination
display_markets() {
    local markets_json="$1"
    local title="$2"
    local page_size="${3:-5}"
    
    local total_count=$(echo "$markets_json" | jq '. | length')
    
    if [ "$total_count" -eq 0 ]; then
        warning "No markets found for $title"
        return
    fi
    
    echo ""
    echo -e "${PURPLE}# $title${NC}"
    echo -e "${WHITE}Found $total_count markets${NC}"
    
    # Display markets
    for i in $(seq 0 $((total_count - 1))); do
        local market=$(echo "$markets_json" | jq ".[$i]")
        format_market_display "$market"
        
        # Add page break every page_size markets
        if [ $((i + 1)) -lt "$total_count" ] && [ $(((i + 1) % page_size)) -eq 0 ]; then
            echo ""
            echo -e "${CYAN}--- Page $((i / page_size + 1)) of $(((total_count - 1) / page_size + 1)) ---${NC}"
            echo -e "${YELLOW}Press Enter to continue or Ctrl+C to exit...${NC}"
            read -r
        fi
    done
    
    echo ""
    echo -e "${GREEN}Displayed all $total_count markets${NC}"
}

# ============================================================================
# MAIN FUNCTIONS
# ============================================================================

# Fetch all NBA markets with pagination (same as Discord bot)
fetch_all_nba_markets() {
    log "Starting NBA markets fetch..."
    
    local all_markets="[]"
    local offset=0
    local batch_count=0
    
    while true; do
        local batch_markets
        if ! batch_markets=$(fetch_markets_from_api "$offset"); then
            if [ "$batch_count" -eq 0 ]; then
                error "Failed to fetch any markets"
                return 1
            else
                warning "Failed to fetch additional markets, using what we have"
                break
            fi
        fi
        
        local batch_size=$(echo "$batch_markets" | jq '. | length')
        if [ "$batch_size" -eq 0 ]; then
            log "No more markets available"
            break
        fi
        
        # Merge with existing markets
        all_markets=$(echo "$all_markets $batch_markets" | jq -s 'add')
        batch_count=$((batch_count + 1))
        offset=$((offset + batch_size))
        
        log "Fetched batch $batch_count with $batch_size markets (total: $(echo "$all_markets" | jq '. | length'))"
        
        # Stop if we got less than the limit (last page)
        if [ "$batch_size" -lt "$LIMIT" ]; then
            log "Reached last page of results"
            break
        fi
        
        # Add delay between requests to be respectful
        sleep 1
    done
    
    local total_fetched=$(echo "$all_markets" | jq '. | length')
    success "Total NBA markets fetched: $total_fetched"
    echo "$all_markets"
}

# Main processing pipeline
process_nba_markets() {
    local market_type="${1:-all}"  # all, moneyline, overunder, spread
    
    log "Processing NBA markets (type: $market_type)..."
    
    # Step 1: Fetch all markets
    local raw_markets
    if ! raw_markets=$(fetch_all_nba_markets); then
        error "Failed to fetch NBA markets"
        return 1
    fi
    
    # Step 2: Filter for future games
    local future_markets
    future_markets=$(filter_future_markets "$raw_markets")
    
    # Step 3: Filter for correct format (2 outcomes)
    local correct_markets
    correct_markets=$(filter_correct_markets "$future_markets")
    
    # Step 4: Apply market type filter if specified
    local final_markets="$correct_markets"
    case "$market_type" in
        "moneyline")
            final_markets=$(filter_nba_markets_by_type "$correct_markets" "moneyline")
            display_markets "$final_markets" "NBA Moneyline Markets"
            ;;
        "overunder"|"totals")
            final_markets=$(filter_nba_markets_by_type "$correct_markets" "overunder")
            display_markets "$final_markets" "NBA Over/Under Markets"
            ;;
        "spread"|"spreads")
            final_markets=$(filter_nba_markets_by_type "$correct_markets" "spread")
            display_markets "$final_markets" "NBA Spread Markets"
            ;;
        "all")
            # Display all market types
            local moneyline_markets=$(filter_nba_markets_by_type "$correct_markets" "moneyline")
            local overunder_markets=$(filter_nba_markets_by_type "$correct_markets" "overunder")
            local spread_markets=$(filter_nba_markets_by_type "$correct_markets" "spread")
            
            display_markets "$moneyline_markets" "NBA Moneyline Markets"
            display_markets "$overunder_markets" "NBA Over/Under Markets"
            display_markets "$spread_markets" "NBA Spread Markets"
            ;;
        *)
            error "Unknown market type: $market_type"
            echo "Valid types: all, moneyline, overunder, spread"
            return 1
            ;;
    esac
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

usage() {
    echo "Usage: $0 [market_type]"
    echo ""
    echo "Fetch and display NBA markets using the same logic as the Discord bot"
    echo ""
    echo "Market types:"
    echo "  all         - Show all market types (default)"
    echo "  moneyline   - Show only moneyline markets"
    echo "  overunder   - Show only over/under markets"
    echo "  spread      - Show only spread markets"
    echo ""
    echo "Environment variables:"
    echo "  GAMMA_HOST  - API host (default: https://gamma.competi.ai)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Show all NBA markets"
    echo "  $0 moneyline        # Show only moneyline markets"
    echo "  $0 overunder        # Show only over/under markets"
    echo "  GAMMA_HOST=https://api.example.com $0 spread"
}

main() {
    local market_type="${1:-all}"
    
    # Handle help flags
    case "$market_type" in
        "-h"|"--help"|"help")
            usage
            exit 0
            ;;
    esac
    
    # Check dependencies
    check_dependencies
    
    # Validate GAMMA_HOST
    if [ -z "$GAMMA_HOST" ]; then
        error "GAMMA_HOST environment variable is required"
        echo "Set it to your Gamma API endpoint, e.g.:"
        echo "export GAMMA_HOST=https://gamma.competi.ai"
        exit 1
    fi
    
    log "NBA Markets Fetcher Starting..."
    log "API Host: $GAMMA_HOST"
    log "Market Type: $market_type"
    echo ""
    
    # Process markets
    if ! process_nba_markets "$market_type"; then
        error "Failed to process NBA markets"
        exit 1
    fi
    
    success "NBA markets fetch completed!"
}

# Run main function with all arguments
main "$@" 