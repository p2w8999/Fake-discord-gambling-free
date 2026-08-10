/**
 * botdata.js — Bot Configuration & Constants
 * CasinoBot, ModerationBot, FunBot, MusicBot, GiveawayBot, AIBot are in bot.js.
 * This file stores global config that bot.js and script.js can both access.
 */

const BOT_CONFIG = {
    adminPassword:    'admin123',
    startingPoints:   100,
    dailyAmount:      100,
    workCooldownMs:   5  * 60 * 1000,  // 5 minutes
    robCooldownMs:    10 * 60 * 1000,  // 10 minutes
    fishCooldownMs:   3  * 60 * 1000,  // 3 minutes
    huntCooldownMs:   4  * 60 * 1000,  // 4 minutes
    maxSavedAccounts: 8,
    pointsPerDollar:  10,              // 10 pts = $1
    vipCost:          50,              // $50 for VIP role
    maxGiveawayDuration: 300,          // 5 minutes max
    maxPurgeMessages:    50,
    maxSlowmodeSecs:     120,
    maxTimeoutMins:      1440,         // 24 hours
    warnThreshold:       3,            // warnings before auto-escalation notice

    // ── AI Bot Parameters ───────────────────────────────────────────────────
    // temperature: 0.0 = very deterministic / focused, 1.0 = very random/creative
    aiTemperature:    0.7,
    // creativity: controls response length and variety
    aiCreativity:     0.75,
    // default personality mode
    aiPersonality:    'friendly',      // friendly | professional | sarcastic | unhinged | philosopher
    // context window (how many past messages to remember)
    aiContextWindow:  8,
    // AI response delay range (ms) — simulates thinking
    aiMinDelay:       600,
    aiMaxDelay:       2000,
};
