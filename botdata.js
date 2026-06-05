/**
 * botdata.js — Bot Configuration & Constants
 * The CasinoBot class lives in bot.js.
 * This file stores global config that bot.js and script.js can both access.
 */

const BOT_CONFIG = {
    adminPassword:   'admin123',
    startingPoints:  100,
    dailyAmount:     100,
    workCooldownMs:  5  * 60 * 1000,  // 5 minutes
    robCooldownMs:   10 * 60 * 1000,  // 10 minutes
    fishCooldownMs:  3  * 60 * 1000,  // 3 minutes
    huntCooldownMs:  4  * 60 * 1000,  // 4 minutes
    maxSavedAccounts: 8,
    pointsPerDollar: 10,              // 10 pts = $1
    vipCost:         50,              // $50 for VIP role
};
