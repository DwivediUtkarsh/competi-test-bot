import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { validateBetPlacement } from '../../../lib/validation';
import { ApiResponse, BetRequest, Bet, SessionData } from '../../../types';
import { getSession } from '../../../lib/kv';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  // Validate request body
  const validationError = validateBetPlacement(req);
  if (validationError) {
    return res.status(400).json(validationError);
  }

  // Extract and verify JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  let jwtPayload: any;
  
  try {
    // Decode JWT to get jti
    jwtPayload = jwt.verify(token, process.env.SESSION_SECRET!) as any;
    
    // Get full session data from KV store
    const sessionData = await getSession(jwtPayload.jti);
    
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: 'Session not found or expired'
      });
    }
    
    // Debug logging to check what we received
    console.log('🔍 Session data from KV store:', JSON.stringify({
      jti: jwtPayload.jti,
      guildName: sessionData.guildName,
      market: sessionData.market,
      hasMarket: !!sessionData.market,
      hasGuildName: !!sessionData.guildName
    }, null, 2));

    const { outcome, amount } = req.body;

    // Extract market and guild info with better fallback logic
    const marketInfo = sessionData.market || {
      question: 'Unknown Market',
      title: 'Unknown Market'
    };
    
    const guildName = sessionData.guildName || 'Unknown';

    // Create bet object with realistic data
    const bet: Bet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: sessionData.discordUser?.id || sessionData.userId,
      marketId: sessionData.marketId,
      outcome,
      amount,
      price: outcome.price,
      potentialPayout: amount / outcome.price,
      status: 'placed',
      placedAt: new Date().toISOString(),
      market: {
        question: marketInfo.question || 'Unknown Market',
        title: marketInfo.title || 'Unknown Market'
      }
    };

    // Send Discord webhook notification
    let webhookSuccess = false;
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        const discordPayload = {
          embeds: [{
            title: '🎯 Bet Placed Successfully!',
            description: `<@${sessionData.discordUser?.id || sessionData.userId}> just placed a bet!`,
            color: 0x00ff00, // Green color
            fields: [
              {
                name: '💰 Amount',
                value: `$${amount.toFixed(2)}`,
                inline: true
              },
              {
                name: '🎲 Outcome',
                value: outcome.title,
                inline: true
              },
              {
                name: '📊 Market',
                value: marketInfo.question || marketInfo.title || 'Unknown Market',
                inline: false
              },
              {
                name: '💵 Potential Win',
                value: `$${bet.potentialPayout.toFixed(2)}`,
                inline: true
              },
              {
                name: '📈 Profit',
                value: `$${(bet.potentialPayout - amount).toFixed(2)}`,
                inline: true
              },
              {
                name: '⏰ Placed At',
                value: new Date().toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) + ' EST',
                inline: true
              }
            ],
            footer: {
              text: `Polymarket Bot • Server: ${guildName}`
            },
            timestamp: new Date().toISOString()
          }]
        };

        await axios.post(webhookUrl, discordPayload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        webhookSuccess = true;
        console.log('✅ Discord webhook notification sent successfully');
      } else {
        console.warn('⚠️ DISCORD_WEBHOOK_URL not configured');
      }
    } catch (webhookError) {
      console.error('❌ Failed to send Discord webhook:', webhookError);
      // Continue even if webhook fails - bet was still placed
    }

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        bet,
        webhookSent: webhookSuccess,
        redirect: sessionData.guildId && sessionData.channelId 
          ? `discord://discord.com/channels/${sessionData.guildId}/${sessionData.channelId}`
          : undefined
      }
    });
    
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
} 