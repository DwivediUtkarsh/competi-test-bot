import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import axios from 'axios';
import { createSession } from '../utils/session.js';
import { 
  getMarketsFromGammaAPI, 
  updateMarketsWithCLOBPrices, 
  decimalToAmericanOdds,
  calculateEuropeanOdds,
  formatVolume,
  formatDate,
  getEventTitleFromMarket,
  getMarketById
} from '../utils/polymarket.js';

// Import categories from config.js
const AVAILABLE_TAGS = {
  "NBA": 745,
  "MLB": 100381,
  "NHL": 899,
  "FIFA Club World Cup": 102192,
  "UFC": 279,
  "ESPORTS": 64
};

// Special NBA Finals condition IDs (same as shell script)
const SPECIAL_NBA_CONDITION_IDS = [
  '0x6edc6c77c16ef3ba1bcd646159f12f8b8a39528e500dcff95b9220ccfbb75141', // OKC Thunder Finals
  '0xf2a89afeddff5315e37211b0b0e4e93ed167fba2694cd35c252672d0aca73711'
];

// Increase number of markets shown on each page from 5 to 10
const ITEMS_PER_PAGE = 10;

const MARKET_EMOJIS = {
  'NBA': { team1: '🏀', team2: '⚔️', draw: '🤝' },
  'NFL': { team1: '🏈', team2: '🏈', draw: '🤝' },
  'Soccer': { team1: '⚽', team2: '⚽', draw: '🤝' },
  'MLB': { team1: '⚾', team2: '⚾', draw: '🤝' },
  'UFC': { team1: '🥊', team2: '🥊', draw: '🤝' },
  'ESPORTS': { team1: '🎮', team2: '🎮', draw: '🤝' },
  'DEFAULT': { team1: '🔥', team2: '🔥', draw: '🤝' }
};

const command = {
  data: new SlashCommandBuilder()
    .setName('markets')
    .setDescription('View live betting markets from Polymarket by category'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Show category selection dropdown
      await this.showCategorySelection(interaction);

    } catch (error) {
      console.error('Error executing markets command:', error);
      await interaction.editReply({
        content: '❌ Failed to load market categories. Please try again later.',
        components: []
      });
    }
  },

  async showCategorySelection(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📊 Polymarket Categories')
      .setDescription('Select a category to view available betting markets:')
      .setColor(0x3498db)
      .addFields([
        { name: '🏀 NBA', value: 'Basketball games and futures', inline: true },
        { name: '⚾ MLB', value: 'Baseball games and futures', inline: true },
        { name: '🏒 NHL', value: 'Hockey games and futures', inline: true },
        { name: '⚽ FIFA Club World Cup', value: 'International football', inline: true },
        { name: '🥊 UFC', value: 'Mixed martial arts', inline: true },
        { name: '🎮 ESPORTS', value: 'Gaming competitions', inline: true }
      ])
      .setFooter({ text: 'Choose a category to see live markets' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('category_select')
      .setPlaceholder('Choose a market category...')
      .addOptions(
        Object.keys(AVAILABLE_TAGS).map(category => ({
          label: category,
          value: category,
          emoji: this.getCategoryEmoji(category),
          description: `View ${category} betting markets`
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  getCategoryEmoji(category) {
    const emojis = {
      'NBA': '🏀',
      'MLB': '⚾',
      'NHL': '🏒',
      'FIFA Club World Cup': '⚽',
      'UFC': '🥊',
      'ESPORTS': '🎮'
    };
    return emojis[category] || '📊';
  },

  // Utility to safely embed category names inside component customIds
  encodeForId(text) {
    return encodeURIComponent(text);
  },

  decodeFromId(text) {
    try { return decodeURIComponent(text); } catch { return text; }
  },

  async handleInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'category_select') {
      await this.handleCategorySelection(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith('keyword_filter_')) {
      await this.handleKeywordFilter(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('bet_')) {
        await this.handleBetButton(interaction);
      } else if (interaction.customId.startsWith('page_')) {
        await this.handlePagination(interaction);
      } else if (interaction.customId.startsWith('nba_type_')) {
        await this.handleNBATypeSelection(interaction);
      }
    }
  },

  async handleCategorySelection(interaction) {
    try {
      const selectedCategory = interaction.values[0];

      // NBA retains existing flow with sub-type buttons
      if (selectedCategory === 'NBA') {
        // Acknowledge the select menu interaction so we can edit the original message
        await interaction.deferUpdate();

        const tagId = AVAILABLE_TAGS[selectedCategory];
        const allMarkets = await this.fetchAllMarkets(tagId);

        if (!allMarkets || allMarkets.length === 0) {
          await interaction.reply({
            content: `📭 No active ${selectedCategory} markets found. Try again later!`,
            components: [],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await this.showNBATypeSelection(interaction, allMarkets, selectedCategory);
        return;
      }

      // For non-NBA categories, prompt user for a keyword via modal
      const modal = new ModalBuilder()
        .setCustomId(`keyword_filter_${selectedCategory}`)
        .setTitle(`Filter ${selectedCategory} Markets`);

      const keywordInput = new TextInputBuilder()
        .setCustomId('keyword_input')
        .setLabel('Enter a keyword (team, player, etc.)')
        .setPlaceholder('e.g. PSG')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(keywordInput));

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error handling category selection:', error);
      // If anything goes wrong, fall back to generic error reply
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Failed to load markets. Please try again later.',
          components: []
        });
      } else {
        await interaction.reply({
          content: '❌ Failed to load markets. Please try again later.',
          components: [],
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },

  async handleKeywordFilter(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Extract category from modal customId
      const selectedCategory = interaction.customId.replace('keyword_filter_', '');
      const keywordRaw = (interaction.fields.getTextInputValue('keyword_input') || '').trim();
      const keyword = keywordRaw.toLowerCase();

      let filteredMarkets = null;

      // Always fetch fresh base markets to ensure keyword "all" returns full set
      if (selectedCategory.startsWith('NBA_')) {
        // Example selectedCategory = 'NBA_moneyline'
        const nbaType = selectedCategory.split('_')[1];
        const allMarketsNBA = await this.fetchAllMarkets(AVAILABLE_TAGS['NBA']);
        let nbaMarkets = this.filterFutureMarketsNBA(allMarketsNBA);
        nbaMarkets = this.filterCorrectMarkets(nbaMarkets);
        switch (nbaType) {
          case 'moneyline':
            nbaMarkets = this.filterNBAMoneylineMarkets(nbaMarkets);
            break;
          case 'overunder':
            nbaMarkets = this.filterNBAOverUnderMarkets(nbaMarkets);
            break;
          case 'spread':
            nbaMarkets = this.filterNBASpreadMarkets(nbaMarkets);
            break;
        }
        filteredMarkets = nbaMarkets;
      } else {
        const tagId = AVAILABLE_TAGS[selectedCategory];
        if (!tagId) {
          await interaction.editReply({
            content: '❌ Unknown market category.',
            components: []
          });
          return;
        }

        const allMarketsGeneric = await this.fetchAllMarkets(tagId);
        if (!allMarketsGeneric || allMarketsGeneric.length === 0) {
          await interaction.editReply({
            content: `📭 No active ${selectedCategory} markets found. Try again later!`,
            components: []
          });
          return;
        }

        filteredMarkets = this.filterFutureMarketsGeneric(allMarketsGeneric);
        filteredMarkets = this.filterCorrectMarkets(filteredMarkets);
      }

      // Apply keyword filtering unless user typed 'all' (case-insensitive) or left blank
      if (keyword && keyword !== 'all') {
        filteredMarkets = filteredMarkets.filter(market => {
          const text = `${market.question ?? ''} ${market.title ?? ''} ${getEventTitleFromMarket(market) ?? ''}`.toLowerCase();
          return text.includes(keyword);
        });
      }

      console.log(`Keyword filter '${keyword}' reduced to ${filteredMarkets.length} markets`);

      if (filteredMarkets.length === 0) {
        await interaction.editReply({
          content: `📭 No markets found for keyword **${keyword || 'N/A'}** in ${selectedCategory}.`,
          components: []
        });
        return;
      }

      // Cache markets for pagination
      interaction.client.marketCache = interaction.client.marketCache || new Map();
      interaction.client.marketCache.set(`${interaction.user.id}_${selectedCategory}`, {
        markets: filteredMarkets,
        tagName: selectedCategory.replace('_', ' ')
      });

      // Show paginated view starting at page 0
      await this.showPaginatedMarkets(interaction, filteredMarkets, selectedCategory.replace('_', ' '), 0);
    } catch (error) {
      console.error('Error handling keyword filter modal:', error);
      await interaction.editReply({
        content: '❌ Failed to filter markets. Please try again later.',
        components: []
      });
    }
  },

  async showNBATypeSelection(interaction, allMarkets, selectedCategory) {
    const embed = new EmbedBuilder()
      .setTitle('🏀 NBA Market Types')
      .setDescription('Select the type of NBA markets you want to view:')
      .setColor(0xff6600)
      .addFields([
        { name: '💰 Moneyline', value: 'Straight win/loss bets', inline: true },
        { name: '📊 Over/Under', value: 'Total points markets', inline: true },
        { name: '📏 Spread', value: 'Point spread markets', inline: true }
      ]);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('nba_type_moneyline')
        .setLabel('Moneyline')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('nba_type_overunder')
        .setLabel('Over/Under')
        .setEmoji('📊')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('nba_type_spread')
        .setLabel('Spread')
        .setEmoji('📏')
        .setStyle(ButtonStyle.Secondary)
    );

    // Cache all NBA markets for sub-filtering
    interaction.client.marketCache = interaction.client.marketCache || new Map();
    interaction.client.marketCache.set(`${interaction.user.id}_NBA_ALL`, { 
      markets: allMarkets, 
      tagName: selectedCategory 
    });

      await interaction.editReply({
        embeds: [embed],
      components: [buttons]
    });
  },

  async handleNBATypeSelection(interaction) {
    try {
      const [, , nbaType] = interaction.customId.split('_');
      
      // Get cached NBA markets
      const cached = interaction.client.marketCache?.get(`${interaction.user.id}_NBA_ALL`);
      if (!cached) {
        await interaction.reply({
          content: '❌ NBA market data expired. Please run /markets again.',
          ephemeral: true
        });
        return;
      }

      // Apply NBA filtering based on type
      let filteredMarkets = this.filterFutureMarketsNBA(cached.markets);
      filteredMarkets = this.filterCorrectMarkets(filteredMarkets);

      // Apply specific NBA type filtering
      switch (nbaType) {
        case 'moneyline':
          filteredMarkets = this.filterNBAMoneylineMarkets(filteredMarkets);
          break;
        case 'overunder':
          filteredMarkets = this.filterNBAOverUnderMarkets(filteredMarkets);
          break;
        case 'spread':
          filteredMarkets = this.filterNBASpreadMarkets(filteredMarkets);
          break;
      }

      console.log(`Filtered NBA ${nbaType} markets: ${filteredMarkets.length}`);

      if (filteredMarkets.length === 0) {
        await interaction.reply({
          content: `📭 No qualifying NBA ${nbaType} markets found.`,
          ephemeral: true
        });
        return;
      }

      // Cache filtered markets
      const cacheKey = `${interaction.user.id}_NBA_${nbaType}`;
      interaction.client.marketCache.set(cacheKey, { 
        markets: filteredMarkets, 
        tagName: `NBA ${nbaType.charAt(0).toUpperCase() + nbaType.slice(1)}`,
        marketType: nbaType
      });

      // Instead of showing immediately, prompt for keyword filter (including option 'all')
      const modal = new ModalBuilder()
        .setCustomId(`keyword_filter_NBA_${nbaType}`)
        .setTitle('Filter NBA Markets');

      const keywordInput = new TextInputBuilder()
        .setCustomId('keyword_input')
        .setLabel('Enter a team abbreviation, player, or "all"')
        .setPlaceholder('e.g. LAL or all')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(keywordInput));

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error handling NBA type selection:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ Failed to load NBA markets. Please try again.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ Failed to load NBA markets. Please try again.',
          ephemeral: true
        });
      }
    }
  },

  // Fetch all markets with pagination (same logic as shell script)
  async fetchAllMarkets(tagId) {
    const baseUrl = process.env.POLYMARKET_API_URL || 'https://gamma.competi.ai';
    const limit = 1000;
    const maxAttempts = 2;
    
    let allMarkets = [];
    let offset = 0;
    let batchCount = 0;
    
    while (true) {
      let batchMarkets = null;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const params = {
            tag_id: tagId,
            closed: false,
            active: true,
            archived: false,
            limit: limit,
            offset: offset
          };
          
          console.log(`Fetching batch ${batchCount + 1}, attempt ${attempt}/${maxAttempts}:`, params);
      
          const response = await axios.get(`${baseUrl}/markets`, {
            params,
            timeout: 10000
          });
          
          batchMarkets = response.data;
          console.log(`Received ${batchMarkets.length} markets in batch ${batchCount + 1}`);
          break;
          
        } catch (error) {
          console.error(`Batch ${batchCount + 1} attempt ${attempt} failed:`, error.message);
          
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!batchMarkets) {
        if (batchCount === 0) {
          throw new Error('Failed to fetch any markets');
        } else {
          console.log('Failed to fetch additional markets, using what we have');
          break;
        }
      }
      
      if (batchMarkets.length === 0) {
        console.log('No more markets available');
        break;
      }
      
      allMarkets = allMarkets.concat(batchMarkets);
      batchCount++;
      offset += batchMarkets.length;
      
      // Stop if we got less than the limit (last page)
      if (batchMarkets.length < limit) {
        console.log('Reached last page of results');
        break;
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Total markets fetched: ${allMarkets.length}`);
    return allMarkets;
  },

  // Filter future markets for NBA (same logic as shell script)
  filterFutureMarketsNBA(markets) {
    if (!Array.isArray(markets)) return [];
    
    const nowMinus24h = Date.now() - 24 * 60 * 60 * 1000; // 24h back buffer
    
    return markets.filter(market => {
      // Always include special NBA Finals markets
      if (SPECIAL_NBA_CONDITION_IDS.includes(market.conditionId)) {
        console.log(`✅ Including special NBA Finals market ${market.id}`);
        return true;
      }
      
      // Check spread
      const spread = parseFloat(market.spread || 0);
      if (spread > 0.05) return false;
      
      // Check game start time
      if (!market.gameStartTime) return false;
      
      const gameTime = Date.parse(market.gameStartTime);
      if (isNaN(gameTime)) return false;
      
      return gameTime > nowMinus24h; // Future game with 24h buffer
    });
  },

  // Filter future markets for other categories (same logic as shell script)
  filterFutureMarketsGeneric(markets) {
    if (!Array.isArray(markets)) return [];
    
    const nowMinus2h = Date.now() - 2 * 60 * 60 * 1000; // 2h back buffer
    
    return markets.filter(market => {
      // Filter out wide-spread markets
      const spread = parseFloat(market.spread || 0);
      if (spread > 0.05) return false;
      
      // Check game start time first
      if (market.gameStartTime) {
        const gameTime = Date.parse(market.gameStartTime);
        if (!isNaN(gameTime)) {
          return gameTime > nowMinus2h;
        }
      }
      
      // Fallback to end date
      if (market.endDate) {
        const endTime = Date.parse(market.endDate);
        if (!isNaN(endTime)) {
          return endTime > Date.now();
        }
      }
      
      // If no timing info, keep it
      return true;
    });
  },

  // Filter markets with exactly 2 outcomes (same logic as shell script)
  filterCorrectMarkets(markets) {
    if (!Array.isArray(markets)) return [];
    
    return markets.filter(market => {
      // Special NBA markets always included
      if (SPECIAL_NBA_CONDITION_IDS.includes(market.conditionId)) {
        return true;
      }
      
      // Check for exactly 2 outcomes
      try {
        let outcomes;
        if (Array.isArray(market.outcomes)) {
          outcomes = market.outcomes;
        } else {
          outcomes = JSON.parse(market.outcomes || '[]');
        }
        return outcomes.length === 2;
      } catch {
        return false;
      }
    });
  },

  // Filter NBA markets by type (same logic as shell script)
  filterNBAMoneylineMarkets(markets) {
    if (!Array.isArray(markets)) return [];
    
    return markets.filter(market => {
      // Always include special finals markets
      if (SPECIAL_NBA_CONDITION_IDS.includes(market.conditionId)) {
        return true;
      }
      
      const sportsMarketType = (market.sportsMarketType || '').toLowerCase();
      
      // Not spreads or totals
      if (sportsMarketType === 'spreads' || sportsMarketType === 'totals') {
        return false;
      }
      
      // Must have exactly 2 outcomes
      try {
        let outcomes;
        if (Array.isArray(market.outcomes)) {
          outcomes = market.outcomes;
        } else {
          outcomes = JSON.parse(market.outcomes || '[]');
        }
        return outcomes.length === 2;
      } catch {
        return false;
      }
    });
  },

  filterNBAOverUnderMarkets(markets) {
    if (!Array.isArray(markets)) return [];
    
    return markets.filter(market => {
      const sportsMarketType = (market.sportsMarketType || '').toLowerCase();
      const spread = parseFloat(market.spread || 0);
      
      return sportsMarketType === 'totals' && spread <= 0.05;
    });
  },

  filterNBASpreadMarkets(markets) {
    if (!Array.isArray(markets)) return [];
    
    return markets.filter(market => {
      const sportsMarketType = (market.sportsMarketType || '').toLowerCase();
      const spread = parseFloat(market.spread || 0);
      
      return sportsMarketType === 'spreads' && spread <= 0.05;
    });
  },

  async handlePagination(interaction) {
    try {
      await interaction.deferUpdate();
      
      const [, direction, encodedCat, currentPage] = interaction.customId.split('_');
      const page = parseInt(currentPage);
      const categoryName = this.decodeFromId(encodedCat);
      const newPage = direction === 'next' ? page + 1 : page - 1;
      
      // Find cached markets for this user
      const marketCache = interaction.client.marketCache;
      if (!marketCache) {
        await interaction.editReply({
          content: '❌ Market data expired. Please run /markets again.',
          components: []
        });
        return;
      }

      const cacheKey = `${interaction.user.id}_${categoryName}`;
      const cached = marketCache.get(cacheKey);
      
      if (!cached) {
        await interaction.editReply({
          content: '❌ Market data expired. Please run /markets again.',
          components: []
        });
        return;
      }
      
      await this.showPaginatedMarkets(interaction, cached.markets, cached.tagName, newPage);
      
    } catch (error) {
      console.error('Error handling pagination:', error);
      await interaction.editReply({
        content: '❌ Navigation error. Please try again.',
        components: []
      });
    }
  },

  async handleBetButton(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Extract market ID from button custom ID
      const customIdParts = interaction.customId.split('_');
      const marketId = customIdParts[1];

      // Fetch fresh market data
      const liveMarket = await getMarketById(marketId);

      let oddsText = 'Live odds unavailable.';
      if (liveMarket && liveMarket.outcomes && liveMarket.outcomePrices) {
        let outcomes;
        let prices;
        try {
          outcomes = Array.isArray(liveMarket.outcomes) ? 
            liveMarket.outcomes : JSON.parse(liveMarket.outcomes);
          prices = Array.isArray(liveMarket.outcomePrices) ?
            liveMarket.outcomePrices.map(p => parseFloat(p)) :
            JSON.parse(liveMarket.outcomePrices).map(p => parseFloat(p));
        } catch {
          outcomes = [];
          prices = [];
        }

        if (outcomes.length === prices.length && outcomes.length > 0) {
          oddsText = outcomes.map((outcome, idx) => {
            const prob = prices[idx];
            const american = decimalToAmericanOdds(prob);
            const euro = calculateEuropeanOdds(prob);
            return `• **${outcome}**  —  ${american}  (EU ${euro})`;
          }).join('\n');
        }
      }

      // Create secure betting session
      const userInfo = {
        id: interaction.user.id,
        username: interaction.user.username,
        discriminator: interaction.user.discriminator,
        avatar: interaction.user.avatar,
        displayName: interaction.user.displayName || interaction.user.username
      };

      const guildInfo = {
        id: interaction.guild?.id,
        name: interaction.guild?.name
      };

      const sessionUrl = await createSession(userInfo, guildInfo, {
        marketId: marketId,
        question: liveMarket?.question || 'Unknown Market',
        title: liveMarket?.title || liveMarket?.question || 'Unknown Market'
      }, {
        channelId: interaction.channel?.id,
        channelName: interaction.channel?.name
      });

      const embed = new EmbedBuilder()
        .setTitle('🎯 Live Market Odds')
        .setDescription(liveMarket?.question || 'Market Details')
        .addFields([
          { name: '📊 Current Odds', value: oddsText, inline: false },
          { name: '💰 Volume', value: this.formatVolume(liveMarket?.volume), inline: true },
          { name: '⏰ Ends', value: this.formatDate(liveMarket?.endDate), inline: true }
        ])
        .setColor(0x00ff00)
        .setFooter({ text: 'Click below to place your bet securely' });

      const betButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Place Bet')
            .setStyle(ButtonStyle.Link)
          .setURL(sessionUrl)
            .setEmoji('💰')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [betButton]
      });

    } catch (error) {
      console.error('Error handling bet button:', error);
      await interaction.editReply({
        content: '❌ Failed to load betting interface. Please try again.',
        components: []
      });
    }
  },

  formatVolume(volume) {
  if (!volume) return 'N/A';
  
  const num = parseFloat(volume);
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(0)}`;
  },

  formatDate(dateString) {
  if (!dateString) return 'TBD';
  
    try {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
      }) + ' EST';
    } catch {
      return 'TBD';
    }
  },

  async showPaginatedMarkets(interaction, markets, title, page) {
    const totalPages = Math.ceil(markets.length / ITEMS_PER_PAGE);
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, markets.length);
    const currentMarkets = markets.slice(startIndex, endIndex);

    // Build one embed per event (max 10 embeds = 10 events) for clarity
    const embeds = currentMarkets.map((market, idx) => {
      const marketString = this.createMarketString(market, title.split(' ')[0]);
      return new EmbedBuilder()
        .setTitle(`${startIndex + idx + 1}. ${getEventTitleFromMarket(market)}`)
        .setDescription(marketString)
        .setColor(0x3498db);
    });

    // Add footer to last embed showing pagination info
    if (embeds.length) {
      embeds[embeds.length - 1].setFooter({ text: `Page ${page + 1} of ${totalPages}` });
    }

    const components = this.createMarketComponents(currentMarkets, page, totalPages, startIndex, title);

    await interaction.editReply({
      content: `${this.getCategoryEmoji(title.split(' ')[0])} ${title} – Showing ${startIndex + 1}-${endIndex} of ${markets.length}`,
      embeds,
      components
    });
  },

  createMarketString(market, marketType = 'DEFAULT') {
    try {
      let outcomes, prices;
      
      // Parse outcomes and prices
      if (Array.isArray(market.outcomes)) {
        outcomes = market.outcomes;
      } else {
        outcomes = JSON.parse(market.outcomes || '[]');
      }
      
      if (Array.isArray(market.outcomePrices)) {
        prices = market.outcomePrices.map(p => parseFloat(p));
      } else {
        prices = JSON.parse(market.outcomePrices || '[]').map(p => parseFloat(p));
      }
      
      let result = '';
      
      if (outcomes.length >= 2 && prices.length >= 2) {
        const price1 = prices[0] || 0;
        const price2 = prices[1] || 0;
        
        const americanOdds1 = decimalToAmericanOdds(price1);
        const americanOdds2 = decimalToAmericanOdds(price2);
        
        const emojis = MARKET_EMOJIS[marketType] || MARKET_EMOJIS['DEFAULT'];
        
        result += `${emojis.team1} **${outcomes[0]}:** ${americanOdds1} | `;
        result += `${emojis.team2} **${outcomes[1]}:** ${americanOdds2}\n`;
      }
      
      // Add game time if available
      if (market.gameStartTime) {
        result += `🗓️ Game: ${this.formatDate(market.gameStartTime)} | `;
      }
      
      if (market.volume) {
        result += `💰 Volume: ${this.formatVolume(market.volume)}`;
      }
      
      // Add market type specific info
      if (market.sportsMarketType === 'totals' && market.line) {
        result += `\n📊 Total Line: ${market.line}`;
      } else if (market.sportsMarketType === 'spreads' && market.line) {
        result += `\n📏 Spread: ${market.line}`;
      }
      
      return result || 'Market data loading...';
    } catch (error) {
      console.error('Error creating market string:', error);
      return 'Market data unavailable';
    }
  },

  createMarketComponents(markets, page, totalPages, startIndex, categoryName) {
    const components = [];

    // Create betting buttons for current page markets
    const betButtons = [];
    markets.forEach((market, index) => {
      betButtons.push(
        new ButtonBuilder()
          .setCustomId(`bet_${market.id}`)
          .setLabel(`Bet ${startIndex + index + 1}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('💰')
      );
    });

    // Split buttons into rows (max 5 per row)
    for (let i = 0; i < betButtons.length; i += 5) {
      const row = new ActionRowBuilder().addComponents(
        betButtons.slice(i, i + 5)
      );
      components.push(row);
    }

    // Add pagination buttons if needed
    if (totalPages > 1) {
      const paginationRow = new ActionRowBuilder();
      
      if (page > 0) {
        paginationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`page_prev_${this.encodeForId(categoryName)}_${page}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬅️')
        );
      }
      
      if (page < totalPages - 1) {
        paginationRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`page_next_${this.encodeForId(categoryName)}_${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('➡️')
        );
      }
      
      if (paginationRow.components.length > 0) {
        components.push(paginationRow);
      }
    }

    return components;
}
};

export default command; 