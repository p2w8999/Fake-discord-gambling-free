/**
 * bot.js — CasinoBot + ModerationBot + FunBot + MusicBot + GiveawayBot + AIBot
 * All commands, logic, channel/permission management, and AI conversation live here.
 */

class CasinoBot {
    constructor(username, serverId) {
        this.username = username;
        this.serverId = serverId || 'gaming-central';
        this.db = this.loadDatabase();
        this.channels = this.loadChannels();
        this.activeChannel = 'general';
        this.initUser();
        // Active giveaway state
        this.activeGiveaway = null;
        this.giveawayEntrants = [];
        // Music queue state
        this.musicQueue = [];
        this.nowPlaying = null;
        this.musicVolume = 80;
        // Slowmode map: channelId -> ms delay
        this.slowmodeMap = {};
        this.lastSlowmodeMsg = {};
        // AI bot instance
        this.ai = new AIBot(username);
    }

    // ─── Persistence ────────────────────────────────────────────────────────────
    loadDatabase() {
        const data = localStorage.getItem('botData_allUsers');
        if (data) { try { return JSON.parse(data); } catch(e) { return {}; } }
        return {};
    }

    loadChannels() {
        const key = `botData_channels_${this.serverId}`;
        const data = localStorage.getItem(key) || localStorage.getItem('botData_channels');
        if (data) { try { return JSON.parse(data); } catch(e) { return this.defaultChannels(); } }
        return this.defaultChannels();
    }

    defaultChannels() {
        return [
            { id: 'announcements', name: 'announcements', topic: '📢 Official server announcements. Stay tuned!', locked: true, requiredRole: 'Admin', icon: 'fa-bullhorn', permissions: {} },
            { id: 'rules',         name: 'rules',         topic: '📜 Server rules — please read before chatting!',  locked: true, requiredRole: 'Admin', icon: 'fa-gavel', permissions: {} },
            { id: 'general',       name: 'general',       topic: '💬 General chat — welcome to the server! Use .help for commands.', icon: 'fa-hashtag', permissions: {} },
            { id: 'memes',         name: 'memes',         topic: '😂 Share memes and use .meme .joke .roast!', icon: 'fa-hashtag', permissions: {} },
            { id: 'bot-commands',  name: 'bot-commands',  topic: '🤖 Use bot commands here! Type .help for a list.', icon: 'fa-robot', permissions: {} },
            { id: 'casino',        name: 'casino',        topic: '🎰 Place your bets! .slots .bet .blackjack .flip', icon: 'fa-hashtag', permissions: {} },
            { id: 'economy',       name: 'economy',       topic: '💰 Work, rob, fish, and earn. .work .fish .hunt .rob', icon: 'fa-hashtag', permissions: {} },
            { id: 'music',         name: 'music',         topic: '🎵 Fake music player! .play .skip .queue .np', icon: 'fa-music', permissions: {} },
            { id: 'giveaways',     name: 'giveaways',     topic: '🎁 Giveaway channel! .giveaway (Admin) — .enter to join!', icon: 'fa-gift', permissions: {} },
            { id: 'trivia',        name: 'trivia',        topic: '🧠 Test your knowledge! Use .trivia', icon: 'fa-hashtag', permissions: {} },
            { id: 'vip-lounge',    name: 'vip-lounge',    topic: '⭐ Exclusive VIP lounge. For VIPs and above only.', locked: true, requiredRole: 'VIP', icon: 'fa-star', permissions: {} },
            { id: 'leaderboard',   name: 'leaderboard',   topic: '🏆 Top players. Use .lb to see rankings.', icon: 'fa-hashtag', permissions: {} },
            { id: 'ai-chat',       name: 'ai-chat',       topic: '🤖 Chat with AIBot! Use .ai <message> or just talk to me!', icon: 'fa-robot', permissions: {} }
        ];
    }

    saveDatabase() { localStorage.setItem('botData_allUsers', JSON.stringify(this.db)); }
    saveChannels()  { localStorage.setItem(`botData_channels_${this.serverId}`, JSON.stringify(this.channels)); }

    // ─── User Init & Accessors ──────────────────────────────────────────────────
    initUser() {
        if (!this.db[this.username]) {
            this.db[this.username] = {
                points: 100, dollars: 0, role: 'Member',
                lastDaily: 0, lastWork: 0, lastRob: 0, lastFish: 0, lastHunt: 0,
                inventory: [], xp: 0, level: 1, wins: 0, losses: 0,
                warnings: [], banned: false, bannedReason: '', mutedUntil: 0,
                timedOutUntil: 0, lastSlowmodeMsg: 0, dailyStreak: 0
            };
            this.isNew = true;
        } else {
            const u = this.db[this.username];
            const patch = { lastWork:0, lastRob:0, lastFish:0, lastHunt:0, inventory:[], xp:0, level:1, wins:0, losses:0,
                warnings:[], banned:false, bannedReason:'', mutedUntil:0, timedOutUntil:0, lastSlowmodeMsg:0, dailyStreak:0 };
            for (const [k,v] of Object.entries(patch)) { if (u[k] === undefined) u[k] = v; }
            this.isNew = false;
        }
        this.saveDatabase();
    }

    get points()   { return this.db[this.username].points; }
    set points(v)  { this.db[this.username].points = Math.max(0, v); }
    get dollars()  { return this.db[this.username].dollars; }
    set dollars(v) { this.db[this.username].dollars = Math.max(0, v); }
    get role()     { return this.db[this.username].role; }
    set role(v)    { this.db[this.username].role = v; }
    get xp()       { return this.db[this.username].xp; }
    set xp(v)      { this.db[this.username].xp = v; }
    get level()    { return this.db[this.username].level; }
    set level(v)   { this.db[this.username].level = v; }
    get wins()     { return this.db[this.username].wins; }
    set wins(v)    { this.db[this.username].wins = v; }
    get losses()   { return this.db[this.username].losses; }
    set losses(v)  { this.db[this.username].losses = v; }
    get inventory(){ return this.db[this.username].inventory; }
    get isAdmin()  { return this.role === 'Admin' || this.role === 'Owner'; }
    get isVIP()    { return this.role === 'VIP' || this.isAdmin; }
    get isBanned() { return this.db[this.username].banned; }
    get isTimedOut() {
        const until = this.db[this.username].timedOutUntil || 0;
        return Date.now() < until;
    }
    get isMuted() {
        const until = this.db[this.username].mutedUntil || 0;
        return Date.now() < until;
    }

    formatCooldown(ms) {
        const s = Math.ceil(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.ceil(s / 60);
        if (m < 60) return `${m}m`;
        return `${Math.ceil(m / 60)}h`;
    }

    addXP(amount) {
        this.xp += amount;
        const xpNeeded = this.level * 200;
        if (this.xp >= xpNeeded) {
            this.xp -= xpNeeded;
            this.level += 1;
            this.saveDatabase();
            return true;
        }
        this.saveDatabase();
        return false;
    }

    weightedRandom(options, weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * total;
        for (let i = 0; i < options.length; i++) {
            rand -= weights[i];
            if (rand <= 0) return options[i];
        }
        return options[options.length - 1];
    }

    // ─── Permission Check ────────────────────────────────────────────────────────
    // Check if current user can post in a channel.
    // Fine-grained overrides: ch.permissions = { 'Member': 'deny', 'VIP': 'allow', 'Admin': 'allow' }
    checkChannelPermission(channelId) {
        const ch = this.channels.find(c => c.id === channelId);
        if (!ch) return true;
        const perms = ch.permissions || {};
        const userRole = this.role;

        // Check fine-grained overrides first (role-level)
        if (perms[userRole] === 'allow') return true;
        if (perms[userRole] === 'deny')  return false;

        // Admins always get through unless explicitly denied
        if (this.isAdmin) return true;

        // Fall back to legacy locked/requiredRole
        if (!ch.locked) return true;
        const req = ch.requiredRole;
        if (!req) return true;
        if (req === 'Admin') return this.isAdmin;
        if (req === 'VIP')   return this.isVIP;
        return false;
    }

    // ─── Set Channel Permission ───────────────────────────────────────────────────
    setChannelPermission(channelId, role, access) {
        const ch = this.channels.find(c => c.id === channelId);
        if (!ch) return false;
        if (!ch.permissions) ch.permissions = {};
        if (access === 'inherit') { delete ch.permissions[role]; }
        else { ch.permissions[role] = access; }
        this.saveChannels();
        return true;
    }

    // ─── Channel Permission Summary ───────────────────────────────────────────────
    getChannelPermissions(channelId) {
        const ch = this.channels.find(c => c.id === channelId);
        if (!ch) return null;
        return { channel: ch, permissions: ch.permissions || {} };
    }

    // ─── Welcome Message ─────────────────────────────────────────────────────────
    getWelcomeMessage() {
        if (this.isNew) {
            return `Welcome to the server, **${this.username}**! 🎉 You have **100 points** to start. Type \`.help\` for bot commands, or go to **#ai-chat** and type \`.ai hello\` to chat with AIBot!`;
        } else {
            return `Welcome back, **${this.username}**! ⚡ **${this.points} pts** | **$${this.dollars}** | Level **${this.level}**. Good luck today! 💪`;
        }
    }

    // ─── Announcement Welcome ─────────────────────────────────────────────────────
    getAnnouncementWelcome() {
        return { type: 'announcement_banner' };
    }

    getRulesWelcome() {
        return { type: 'rules_banner' };
    }

    // ─── Command Router ──────────────────────────────────────────────────────────
    processCommand(input) {
        const args = input.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // ── Economy & Casino
        switch (command) {
            // Help
            case 'help':            return this.cmdHelp();

            // AI Bot
            case 'ai':              return this.cmdAI(args);
            case 'aiparam':         return this.cmdAIParam(args);
            case 'aimode':          return this.cmdAIMode(args);
            case 'aistats':         return this.cmdAIStats();

            // Economy
            case 'bal':
            case 'balance':         return this.cmdBalance();
            case 'profile':
            case 'p':               return this.cmdProfile(args);
            case 'convert':         return this.cmdConvert(args);
            case 'daily':           return this.cmdDaily();
            case 'work':            return this.cmdWork();
            case 'fish':            return this.cmdFish();
            case 'hunt':            return this.cmdHunt();
            case 'rob':             return this.cmdRob(args);
            case 'pay':             return this.cmdPay(args);
            case 'leaderboard':
            case 'lb':              return this.cmdLeaderboard();

            // Shop
            case 'shop':            return this.cmdShop();
            case 'buy':             return this.cmdBuy(args);
            case 'inventory':
            case 'inv':             return this.cmdInventory();

            // Casino Games
            case 'bet':             return this.cmdBet(args);
            case 'slots':           return this.cmdSlots(args);
            case 'blackjack':
            case 'bj':              return this.cmdBlackjack(args);
            case 'flip':            return this.cmdFlip(args);

            // Mini Games
            case 'rps':             return this.cmdRPS(args);
            case '8ball':           return this.cmd8Ball(args);
            case 'trivia':          return this.cmdTrivia();

            // FunBot
            case 'meme':            return this.cmdMeme();
            case 'joke':            return this.cmdJoke();
            case 'quote':           return this.cmdQuote();
            case 'rate':            return this.cmdRate(args);
            case 'ship':            return this.cmdShip(args);
            case 'roll':            return this.cmdRoll(args);
            case 'choose':          return this.cmdChoose(args);
            case 'compliment':      return this.cmdCompliment(args);
            case 'roast':           return this.cmdRoast(args);
            case 'ascii':           return this.cmdAscii(args);
            case 'coinflip':        return this.cmdFlip(args);

            // MusicBot
            case 'play':            return this.cmdPlay(args);
            case 'skip':            return this.cmdSkip();
            case 'queue':           return this.cmdQueue();
            case 'nowplaying':
            case 'np':              return this.cmdNowPlaying();
            case 'volume':          return this.cmdVolume(args);

            // GiveawayBot
            case 'giveaway':
                if (!this.isAdmin) return { type: 'text', content: '❌ You need **Admin** or higher to start a giveaway.' };
                return this.cmdGiveaway(args);
            case 'enter':           return this.cmdEnterGiveaway();

            // Admin — Announce
            case 'announce':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdAnnounce(args);

            // Admin — Moderation
            case 'ban':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdBan(args);
            case 'unban':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdUnban(args);
            case 'kick':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdKick(args);
            case 'timeout':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdTimeout(args);
            case 'untimeout':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdUntimeout(args);
            case 'mute':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdMute(args);
            case 'unmute':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdUnmute(args);
            case 'warn':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdWarn(args);
            case 'warns':           return this.cmdWarns(args);
            case 'banlist':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdBanlist();
            case 'slowmode':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdSlowmode(args);
            case 'purge':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdPurge(args);

            // Legacy admin
            case 'give':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdGive(args);
            case 'take':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdTake(args);
            case 'setrole':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdSetRole(args);
            case 'createchannel':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdCreateChannel(args);
            case 'deletechannel':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdDeleteChannel(args);
            case 'clear':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return { type: 'system', action: 'clear_chat', content: '🧹 Chat cleared by admin.' };
            case 'resetdb':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdResetDB(args);

            // Channel Permissions
            case 'permissions':
            case 'perms':           return this.cmdPermissions(args);
            case 'setperm':
            case 'setpermission':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdSetPermission(args);

            // Server Info
            case 'serverinfo':      return this.cmdServerInfo();

            // Secret admin unlock
            case 'iamadmin':
                this.role = 'Owner';
                this.saveDatabase();
                return { type: 'system', action: 'update_roles', content: '👑 You are now an **Owner**. Shh, keep it secret.' };

            default:
                return { type: 'text', content: `❓ Unknown command \`.${command}\`. Type \`.help\` for a list.` };
        }
    }

    // ─── Help ────────────────────────────────────────────────────────────────────
    cmdHelp() {
        return {
            type: 'embed',
            title: '🤖 All Commands — Discord Bot Suite',
            fields: [
                { name: '🧠 AIBot', value: '`.ai <message>` chat with AI · `.aiparam <temp|creativity> <0-1>` · `.aimode <friendly|professional|sarcastic|unhinged|philosopher>` · `.aistats`' },
                { name: '💰 Economy', value: '`.bal` `.daily` `.work` `.fish` `.hunt` `.rob <user>` `.pay <user> <amt>` `.convert <amt>`' },
                { name: '🎰 Casino Games', value: '`.bet coinflip <amt> [h/t]` `.bet dice <amt>` `.slots <amt>` `.blackjack <amt>` `.flip <amt>`' },
                { name: '🎮 Mini Games', value: '`.rps <rock|paper|scissors>` `.8ball <question>` `.trivia`' },
                { name: '😂 FunBot', value: '`.meme` `.joke` `.quote` `.rate <thing>` `.ship <u1> <u2>` `.roll <NdN>` `.choose <a|b|c>` `.compliment <user>` `.roast <user>` `.ascii <text>`' },
                { name: '🎵 MusicBot', value: '`.play <song>` `.skip` `.queue` `.np` `.volume <0-100>`' },
                { name: '🎁 GiveawayBot', value: '`.giveaway <prize> <seconds>` (Admin) · `.enter` (join a giveaway)' },
                { name: '🏪 Shop & Inventory', value: '`.shop` `.buy <item>` `.inventory`' },
                { name: '📊 Stats', value: '`.profile [user]` `.leaderboard` `.serverinfo` `.warns <user>`' },
                { name: '🔐 Permissions', value: '`.perms <channel>` view · `.setperm <channel> <role> <allow|deny|inherit>` (Admin)' },
                { name: '🔒 Admin — Moderation', value: '`.ban <user> [reason]` `.unban <user>` `.kick <user>` `.timeout <user> <mins>` `.untimeout <user>` `.mute <user>` `.unmute <user>` `.warn <user> <reason>` `.banlist` `.purge <n>` `.slowmode <sec>` `.announce <msg>` `.setrole <user> <role>` `.give` `.take` `.createchannel` `.deletechannel` `.clear` `.resetdb`' }
            ],
            color: 'default'
        };
    }

    // ─── AI Bot Commands ─────────────────────────────────────────────────────────
    cmdAI(args) {
        if (!args.length) return { type: 'text', content: '🤖 Usage: `.ai <your message>` — Chat with AIBot!', botName: 'AIBot' };
        const message = args.join(' ');
        const response = this.ai.respond(message, this.username);
        return { type: 'ai_response', content: response, botName: 'AIBot', isStreaming: true };
    }

    cmdAIParam(args) {
        if (args.length < 2) {
            const stats = this.ai.getStats();
            return { type: 'embed', title: '⚙️ AIBot Parameters',
                fields: [
                    { name: '🌡️ Temperature', value: `**${stats.temperature}** — ${stats.temperature < 0.3 ? 'Very focused' : stats.temperature < 0.6 ? 'Balanced' : stats.temperature < 0.85 ? 'Creative' : 'Wild!'}` },
                    { name: '🎨 Creativity', value: `**${stats.creativity}** — ${stats.creativity < 0.3 ? 'Short & direct' : stats.creativity < 0.6 ? 'Moderate' : 'Verbose & expressive'}` },
                    { name: '🎭 Personality', value: `**${stats.personality}**` },
                    { name: '💬 Context Window', value: `**${stats.contextLength}** / ${stats.maxContext} messages remembered` }
                ], color: 'default', botName: 'AIBot' };
        }
        const param = args[0].toLowerCase();
        const val = parseFloat(args[1]);
        if (isNaN(val) || val < 0 || val > 1) return { type: 'text', content: '❌ Value must be between **0.0** and **1.0**.', botName: 'AIBot' };
        if (param === 'temperature' || param === 'temp') {
            this.ai.temperature = val;
            const desc = val < 0.3 ? 'Very focused — will give predictable responses.' : val < 0.6 ? 'Balanced — a good mix of creative and reliable.' : val < 0.85 ? 'Creative — expect varied and surprising replies.' : '🔥 WILD MODE — anything goes!';
            return { type: 'text', content: `🌡️ Temperature set to **${val}**\n*${desc}*`, botName: 'AIBot' };
        }
        if (param === 'creativity') {
            this.ai.creativity = val;
            return { type: 'text', content: `🎨 Creativity set to **${val}** — responses will be ${val < 0.4 ? 'short and direct' : val < 0.7 ? 'moderately detailed' : 'long and expressive'}.`, botName: 'AIBot' };
        }
        return { type: 'text', content: `❌ Unknown parameter \`${param}\`. Use \`temperature\` or \`creativity\`.`, botName: 'AIBot' };
    }

    cmdAIMode(args) {
        if (!args.length) return { type: 'text', content: '❌ Usage: `.aimode <friendly|professional|sarcastic|unhinged|philosopher>`', botName: 'AIBot' };
        const mode = args[0].toLowerCase();
        const modes = ['friendly', 'professional', 'sarcastic', 'unhinged', 'philosopher'];
        if (!modes.includes(mode)) return { type: 'text', content: `❌ Unknown mode. Available: **${modes.join(', ')}**`, botName: 'AIBot' };
        this.ai.personality = mode;
        const modeDescs = {
            friendly: '😊 Friendly mode — warm, helpful, and enthusiastic!',
            professional: '💼 Professional mode — formal, precise, and efficient.',
            sarcastic: '😏 Sarcastic mode — will definitely roast you a little.',
            unhinged: '🤪 Unhinged mode — chaotic, wild, unpredictable energy!',
            philosopher: '🧘 Philosopher mode — deep thoughts and contemplative musings.'
        };
        return { type: 'text', content: `🎭 AIBot personality changed to **${mode}**!\n${modeDescs[mode]}\n\nTry it: \`.ai tell me something interesting\``, botName: 'AIBot' };
    }

    cmdAIStats() {
        const stats = this.ai.getStats();
        const tempBar = '█'.repeat(Math.round(stats.temperature * 10)) + '░'.repeat(10 - Math.round(stats.temperature * 10));
        const crtvBar = '█'.repeat(Math.round(stats.creativity * 10)) + '░'.repeat(10 - Math.round(stats.creativity * 10));
        return { type: 'embed', title: '🤖 AIBot System Status',
            fields: [
                { name: '🌡️ Temperature', value: `\`[${tempBar}]\` ${stats.temperature}` },
                { name: '🎨 Creativity',  value: `\`[${crtvBar}]\` ${stats.creativity}` },
                { name: '🎭 Personality', value: `**${stats.personality}**` },
                { name: '💬 Conversation Context', value: `${stats.contextLength} message${stats.contextLength !== 1 ? 's' : ''} in memory (max ${stats.maxContext})` },
                { name: '⚙️ Engine', value: 'Parameterized Weighted Response Engine v2.0' },
                { name: '📡 Status', value: '🟢 Online & Ready' }
            ], color: 'default', botName: 'AIBot' };
    }

    // ─── Permission Commands ──────────────────────────────────────────────────────
    cmdPermissions(args) {
        const channelId = args[0] ? args[0].replace('#','') : this.activeChannel;
        const result = this.getChannelPermissions(channelId);
        if (!result) return { type: 'text', content: `❌ Channel **#${channelId}** not found.` };
        const ch = result.channel;
        const perms = result.permissions;
        const roles = ['Member', 'VIP', 'Admin', 'Owner'];
        const lines = roles.map(r => {
            const p = perms[r];
            const icon = p === 'allow' ? '✅' : p === 'deny' ? '❌' : '⬜';
            const label = p || 'inherit';
            return `${icon} **${r}** — ${label}`;
        });
        const lockStatus = ch.locked ? `🔒 Locked (requires ${ch.requiredRole})` : '🔓 Open';
        return { type: 'embed', title: `🔐 Permissions — #${ch.name}`,
            fields: [
                { name: '📌 Lock Status', value: lockStatus },
                { name: '👥 Role Overrides', value: lines.join('\n') || 'None set' },
                { name: '💡 How to change', value: '`.setperm #channel <role> <allow|deny|inherit>` (Admin only)' }
            ], color: 'default' };
    }

    cmdSetPermission(args) {
        if (args.length < 3) return { type: 'text', content: 'Usage: `.setperm <channel> <role> <allow|deny|inherit>`' };
        const channelId = args[0].replace('#','').toLowerCase();
        const role = args[1];
        const access = args[2].toLowerCase();
        const validRoles = ['Member', 'VIP', 'Admin', 'Owner'];
        const validAccess = ['allow', 'deny', 'inherit'];
        const matched = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
        if (!matched) return { type: 'text', content: `❌ Invalid role. Use: **${validRoles.join(', ')}**` };
        if (!validAccess.includes(access)) return { type: 'text', content: `❌ Access must be: **allow**, **deny**, or **inherit**` };
        const ok = this.setChannelPermission(channelId, matched, access);
        if (!ok) return { type: 'text', content: `❌ Channel **#${channelId}** not found.` };
        const icon = access === 'allow' ? '✅' : access === 'deny' ? '❌' : '⬜';
        return { type: 'system', action: 'update_channels',
            content: `${icon} Permission updated: **${matched}** can now **${access}** access to **#${channelId}**.` };
    }

    // ─── Server Info ──────────────────────────────────────────────────────────────
    cmdServerInfo() {
        const serverData = (() => {
            try { const s = JSON.parse(localStorage.getItem('discord_servers') || '{}'); return s[this.serverId] || {}; } catch { return {}; }
        })();
        const userCount = Object.keys(this.db).length;
        const adminCount = Object.values(this.db).filter(u => u.role === 'Admin' || u.role === 'Owner').length;
        const vipCount = Object.values(this.db).filter(u => u.role === 'VIP').length;
        const bannedCount = Object.values(this.db).filter(u => u.banned).length;
        return { type: 'embed', title: `🏰 Server Info — ${serverData.name || 'Gaming Central'}`,
            fields: [
                { name: '📛 Name', value: serverData.name || 'Gaming Central' },
                { name: '📝 Description', value: serverData.description || 'A gaming community server!' },
                { name: '🆔 Server ID', value: `\`${this.serverId}\`` },
                { name: '👑 Owner', value: serverData.ownerId || 'System' },
                { name: '📋 Channels', value: `${this.channels.length}` },
                { name: '👥 Members', value: `${userCount} total | ${adminCount} admins | ${vipCount} VIPs | ${bannedCount} banned` },
                { name: '📅 Created', value: serverData.createdAt ? new Date(serverData.createdAt).toLocaleDateString() : 'Ancient times' }
            ], color: 'default' };
    }

    // ─── Economy ─────────────────────────────────────────────────────────────────
    cmdBalance() {
        const xpNeeded = this.level * 200;
        const xpBar = Math.floor((this.xp / xpNeeded) * 10);
        const bar = '█'.repeat(xpBar) + '░'.repeat(10 - xpBar);
        return {
            type: 'embed',
            title: `💰 Balance — ${this.username}`,
            fields: [
                { name: '🪙 Points',   value: `**${this.points.toLocaleString()} pts**` },
                { name: '💵 Dollars',  value: `**$${this.dollars.toLocaleString()}**` },
                { name: '🎖️ Role',    value: this.role },
                { name: `⭐ Level ${this.level}`, value: `\`[${bar}]\` ${this.xp}/${xpNeeded} XP` }
            ],
            color: 'default'
        };
    }

    cmdProfile(args) {
        const target = args.length > 0 ? args[0] : this.username;
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        const u = this.db[target];
        const total = (u.wins||0)+(u.losses||0);
        const wr = total > 0 ? Math.round(((u.wins||0)/total)*100) : 0;
        const xpNeeded = (u.level||1)*200;
        const xpBar = Math.floor(((u.xp||0)/xpNeeded)*10);
        const bar = '█'.repeat(xpBar) + '░'.repeat(10-xpBar);
        const status = u.banned ? '🔨 Banned' : (Date.now() < (u.timedOutUntil||0)) ? '⏰ Timed Out' : (Date.now() < (u.mutedUntil||0)) ? '🔇 Muted' : '🟢 Active';
        return {
            type: 'embed',
            title: `👤 Profile — ${target}`,
            fields: [
                { name: '🎖️ Role',       value: u.role },
                { name: '📶 Status',      value: status },
                { name: `⭐ Level ${u.level||1}`, value: `\`[${bar}]\` ${u.xp||0}/${xpNeeded} XP` },
                { name: '🪙 Points',      value: `${(u.points||0).toLocaleString()} pts` },
                { name: '💵 Dollars',     value: `$${(u.dollars||0).toLocaleString()}` },
                { name: '🏆 Win Rate',    value: `${wr}% (${u.wins||0}W / ${u.losses||0}L)` },
                { name: '⚠️ Warnings',   value: `${(u.warnings||[]).length}` },
                { name: '🎒 Inventory',   value: (u.inventory||[]).length > 0 ? (u.inventory||[]).join(', ') : 'Empty' }
            ],
            color: 'default'
        };
    }

    cmdDaily() {
        const now = Date.now();
        const last = this.db[this.username].lastDaily || 0;
        const oneDay = 24*60*60*1000;
        if (now - last < oneDay) {
            return { type: 'text', content: `⏰ Daily already claimed! Come back in **${this.formatCooldown(oneDay-(now-last))}**.` };
        }
        const streak = this.db[this.username].dailyStreak || 0;
        const newStreak = (now - last < oneDay*2) ? streak+1 : 1;
        const bonus = Math.min(newStreak*10, 100);
        const reward = 100+bonus;
        this.points += reward;
        this.db[this.username].lastDaily = now;
        this.db[this.username].dailyStreak = newStreak;
        const leveled = this.addXP(50);
        this.saveDatabase();
        return {
            type: 'embed', title: '🎁 Daily Reward Claimed!',
            fields: [
                { name: '🎁 Received',      value: `**+${reward} pts**` },
                { name: '🔥 Streak',        value: `**${newStreak} day${newStreak>1?'s':''}** (+${bonus} bonus)` },
                { name: '💰 New Balance',   value: `${this.points} pts` },
                leveled ? { name: '⭐ Level Up!', value: `You reached Level **${this.level}**!` } : null
            ].filter(Boolean),
            color: 'win'
        };
    }

    cmdConvert(args) {
        if (!args.length) return { type: 'text', content: 'Usage: `.convert <amount>`' };
        let amount = args[0].toLowerCase() === 'all' ? this.points : parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };
        const dollars = Math.floor(amount/10);
        if (dollars === 0) return { type: 'text', content: '❌ You need at least **10 pts** to convert into $1.' };
        const spent = dollars*10;
        this.points -= spent; this.dollars += dollars;
        this.saveDatabase();
        return { type: 'embed', title: '💱 Conversion Successful',
            fields: [
                { name: '📤 Spent',         value: `${spent} pts` },
                { name: '📥 Received',      value: `$${dollars}` },
                { name: '💰 New Balance',   value: `${this.points} pts | $${this.dollars}` }
            ], color: 'win' };
    }

    cmdWork() {
        const now = Date.now();
        const cooldown = 5*60*1000;
        const last = this.db[this.username].lastWork || 0;
        if (now-last < cooldown) return { type: 'text', content: `⏰ You're tired! Rest for **${this.formatCooldown(cooldown-(now-last))}**.`, botName: 'EconomyBot' };
        const jobs = [
            { text: 'delivered pizzas', min: 20, max: 60 },
            { text: 'coded a website', min: 40, max: 90 },
            { text: 'drove for Uber', min: 15, max: 50 },
            { text: 'sold lemonade', min: 10, max: 30 },
            { text: 'streamed on Twitch', min: 5, max: 100 },
            { text: 'mined crypto', min: 1, max: 200 },
            { text: 'walked dogs', min: 20, max: 55 },
            { text: 'fixed computers', min: 30, max: 80 },
            { text: 'designed a logo', min: 25, max: 75 },
            { text: 'tutored a student', min: 20, max: 60 }
        ];
        const job = jobs[Math.floor(Math.random()*jobs.length)];
        const earnings = Math.floor(Math.random()*(job.max-job.min+1))+job.min;
        this.points += earnings;
        this.db[this.username].lastWork = now;
        const leveled = this.addXP(20);
        this.saveDatabase();
        return { type: 'text', content: `💼 You ${job.text} and earned **+${earnings} pts**!${leveled?` ⭐ Level up! You're now Level **${this.level}**!`:''}`, botName: 'EconomyBot' };
    }

    cmdFish() {
        const now = Date.now();
        const cooldown = 3*60*1000;
        const last = this.db[this.username].lastFish || 0;
        if (now-last < cooldown) return { type: 'text', content: `⏰ The fish aren't biting! Wait **${this.formatCooldown(cooldown-(now-last))}**.`, botName: 'EconomyBot' };
        const hasRod = this.inventory.includes('🎣 Pro Rod');
        const catches = [
            {name:'nothing 🪣',pts:0},{name:'a Boot 👟',pts:2},{name:'a Small Fish 🐟',pts:10},
            {name:'a Salmon 🐠',pts:20},{name:'a Tuna 🐡',pts:35},{name:'a Swordfish ⚔️',pts:60},{name:'a Legendary Kraken 🦑',pts:200}
        ];
        const caught = this.weightedRandom(catches,[10,15,30,25,12,6,2]);
        let pts = caught.pts;
        if (hasRod) pts = Math.floor(pts*1.5);
        this.db[this.username].lastFish = now;
        if (pts>0) { this.points+=pts; this.addXP(10); }
        this.saveDatabase();
        return { type:'text', content: pts>0 ? `🎣 You caught **${caught.name}**!${hasRod?' (Pro Rod bonus!)':''} **+${pts} pts**` : `🎣 You fished and caught **${caught.name}**. Better luck next time!`, botName:'EconomyBot' };
    }

    cmdHunt() {
        const now = Date.now();
        const cooldown = 4*60*1000;
        const last = this.db[this.username].lastHunt || 0;
        if (now-last < cooldown) return { type:'text', content:`⏰ No animals in sight! Try again in **${this.formatCooldown(cooldown-(now-last))}**.`, botName:'EconomyBot' };
        const hasBow = this.inventory.includes('🏹 Hunter Bow');
        const prey = [
            {name:'nothing 🌿',pts:0},{name:'a Rabbit 🐇',pts:15},{name:'a Deer 🦌',pts:40},
            {name:'a Wolf 🐺',pts:65},{name:'a Bear 🐻',pts:90},{name:'a Dragon 🐉',pts:250}
        ];
        const hunted = this.weightedRandom(prey,[15,30,25,15,10,5]);
        let pts = hunted.pts;
        if (hasBow) pts = Math.floor(pts*1.5);
        this.db[this.username].lastHunt = now;
        if (pts>0) { this.points+=pts; this.addXP(10); }
        this.saveDatabase();
        return { type:'text', content: pts>0 ? `🏹 You hunted **${hunted.name}**!${hasBow?' (Hunter Bow bonus!)':''} **+${pts} pts**` : `🏹 You found **${hunted.name}**. The hunt continues...`, botName:'EconomyBot' };
    }

    cmdRob(args) {
        if (!args.length) return { type:'text', content:'Usage: `.rob <user>`', botName:'EconomyBot' };
        const target = args[0];
        const now = Date.now();
        const cooldown = 10*60*1000;
        const last = this.db[this.username].lastRob || 0;
        if (now-last < cooldown) return { type:'text', content:`⏰ Lay low for **${this.formatCooldown(cooldown-(now-last))}**.`, botName:'EconomyBot' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'EconomyBot' };
        if (target === this.username) return { type:'text', content:"🤦 You can't rob yourself!", botName:'EconomyBot' };
        if (this.db[target].points < 20) return { type:'text', content:`💸 **${target}** is too broke. Have some mercy!`, botName:'EconomyBot' };
        const hasShield = (this.db[target].inventory||[]).includes('🛡️ Robber Shield');
        this.db[this.username].lastRob = now;
        if (hasShield) {
            const idx = this.db[target].inventory.indexOf('🛡️ Robber Shield');
            this.db[target].inventory.splice(idx,1);
            const fine = Math.floor(Math.random()*20)+10;
            this.points -= Math.min(fine,this.points);
            this.saveDatabase();
            return { type:'text', content:`🛡️ **${target}** had a **Robber Shield**! You got fined **${fine} pts**!`, botName:'EconomyBot' };
        }
        const success = Math.random() > 0.45;
        if (success) {
            const stolen = Math.min(Math.floor(Math.random()*30)+10, this.db[target].points);
            this.db[target].points -= stolen;
            this.points += stolen;
            this.addXP(15);
            this.saveDatabase();
            return { type:'text', content:`🦹 You robbed **${stolen} pts** from **${target}**!`, botName:'EconomyBot' };
        } else {
            const fine = Math.min(Math.floor(Math.random()*20)+10, this.points);
            this.points -= fine;
            this.saveDatabase();
            return { type:'text', content:`👮 You got caught robbing **${target}** and fined **${fine} pts**!`, botName:'EconomyBot' };
        }
    }

    cmdPay(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.pay <user> <amount>`' };
        const target = args[0]; let amount = parseInt(args[1]);
        if (isNaN(amount)||amount<=0) return { type:'text', content:'❌ Invalid amount.' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.` };
        if (target===this.username) return { type:'text', content:"❌ You can't pay yourself!" };
        if (this.points<amount) return { type:'text', content:`❌ You only have **${this.points} pts**.` };
        this.points -= amount; this.db[target].points += amount;
        this.saveDatabase();
        return { type:'text', content:`💸 You paid **${amount} pts** to **${target}**!` };
    }

    cmdLeaderboard() {
        const users = Object.keys(this.db).map(name=>({
            name, points:this.db[name].points||0, dollars:this.db[name].dollars||0, level:this.db[name].level||1
        })).sort((a,b)=>b.points-a.points).slice(0,10);
        const medals = ['🥇','🥈','🥉'];
        const desc = users.map((u,i)=>`${medals[i]||`**${i+1}.**`} **${u.name}** — ${u.points.toLocaleString()} pts | $${u.dollars} | Lv.${u.level}`).join('\n');
        return { type:'embed', title:'🏆 Global Leaderboard', fields:[{name:'Top Players',value:desc||'No players yet.'}], color:'default' };
    }

    // ─── Shop & Inventory ────────────────────────────────────────────────────────
    cmdShop() {
        return { type:'embed', title:'🏪 Item Shop',
            fields:[
                { name:'⭐ VIP Role — $50',       value:'Get a golden name and exclusive VIP channel access.' },
                { name:'🎟️ Lucky Ticket — 200 pts', value:'Doubles your next slot jackpot win.' },
                { name:'🛡️ Robber Shield — 100 pts', value:'Protects you from being robbed once.' },
                { name:'🎣 Pro Rod — 150 pts',      value:'Increases fishing rewards by 50%.' },
                { name:'🏹 Hunter Bow — 150 pts',   value:'Increases hunting rewards by 50%.' },
                { name:'💊 XP Boost — 300 pts',     value:'Doubles XP gain for 24 hours.' },
                { name:'🎵 DJ Pass — 200 pts',      value:'Unlocks `.play` priority queue skips.' },
                { name:'🍀 Lucky Charm — 250 pts',  value:'Increases all game win chance by 5%.' }
            ], color:'default' };
    }

    cmdBuy(args) {
        if (!args.length) return { type:'text', content:'Usage: `.buy <item>` — See `.shop` for items.' };
        const item = args[0].toLowerCase();
        const items = {
            'vip':   { cost:50, currency:'dollars',  name:'VIP Role' },
            'ticket':{ cost:200,currency:'points',   name:'🎟️ Lucky Ticket' },
            'shield':{ cost:100,currency:'points',   name:'🛡️ Robber Shield' },
            'rod':   { cost:150,currency:'points',   name:'🎣 Pro Rod' },
            'bow':   { cost:150,currency:'points',   name:'🏹 Hunter Bow' },
            'boost': { cost:300,currency:'points',   name:'💊 XP Boost' },
            'dj':    { cost:200,currency:'points',   name:'🎵 DJ Pass' },
            'charm': { cost:250,currency:'points',   name:'🍀 Lucky Charm' }
        };
        const found = items[item];
        if (!found) return { type:'text', content:'❌ Unknown item. Use `.shop` to see available items.' };
        if (item==='vip') {
            if (this.isVIP) return { type:'text', content:'✅ You already have VIP or higher.' };
            if (this.dollars<50) return { type:'text', content:`❌ VIP costs **$50**. You have **$${this.dollars}**. Use \`.convert\` to get dollars.` };
            this.dollars -= 50; this.role = 'VIP'; this.saveDatabase();
            return { type:'system', action:'update_roles', content:'🎉 You bought the **VIP** role! Your name is now golden and you can access #vip-lounge!' };
        }
        const bal = found.currency==='dollars' ? this.dollars : this.points;
        if (bal<found.cost) return { type:'text', content:`❌ **${found.name}** costs **${found.cost} ${found.currency}**. You have **${bal}**.` };
        if (this.inventory.includes(found.name)) return { type:'text', content:`❌ You already own **${found.name}**!` };
        if (found.currency==='dollars') this.dollars-=found.cost; else this.points-=found.cost;
        this.inventory.push(found.name);
        this.saveDatabase();
        return { type:'embed', title:'🛒 Purchase Successful!',
            fields:[{name:'Item',value:found.name},{name:'Cost',value:`${found.cost} ${found.currency}`}], color:'win' };
    }

    cmdInventory() {
        return { type:'embed', title:`🎒 Inventory — ${this.username}`,
            fields:[{name:'Items',value:this.inventory.length>0?this.inventory.join('\n'):'Empty. Use `.shop` to buy items!'}], color:'default' };
    }

    // ─── Casino Games ────────────────────────────────────────────────────────────
    cmdBet(args) {
        if (args.length<2) return { type:'text', content:'Usage: `.bet <game> <amount> [options]`' };
        const game = args[0].toLowerCase();
        let amount = args[1].toLowerCase()==='all' ? this.points : parseInt(args[1]);
        if (isNaN(amount)||amount<=0) return { type:'text', content:'❌ Invalid bet amount.' };
        if (this.points<amount) return { type:'text', content:`❌ You only have **${this.points} pts**.` };
        if (game==='coinflip'||game==='cf') return this.playCoinflip(amount,args[2]);
        if (game==='dice') return this.playDice(amount);
        return { type:'text', content:`❌ Unknown game \`${game}\`. Available: \`coinflip\`, \`dice\`.` };
    }

    cmdSlots(args) {
        if (!args.length) return { type:'text', content:'Usage: `.slots <amount>`' };
        let amount = args[0].toLowerCase()==='all' ? this.points : parseInt(args[0]);
        if (isNaN(amount)||amount<=0) return { type:'text', content:'❌ Invalid amount.' };
        if (this.points<amount) return { type:'text', content:`❌ You only have **${this.points} pts**.` };
        const hasTicket = this.inventory.includes('🎟️ Lucky Ticket');
        const hasCharm = this.inventory.includes('🍀 Lucky Charm');
        const symbols = ['🍒','🍋','🍇','🍉','⭐','💎','7️⃣'];
        const weights = hasCharm ? [25,22,18,14,10,7,4] : [30,25,20,15,5,3,2];
        const spin = Array.from({length:3},()=>this.weightedRandom(symbols,weights));
        const allSame = spin[0]===spin[1]&&spin[1]===spin[2];
        const twoSame = spin[0]===spin[1]||spin[1]===spin[2]||spin[0]===spin[2];
        if (allSame) {
            const multipliers={'🍒':3,'🍋':3,'🍇':4,'🍉':4,'⭐':8,'💎':20,'7️⃣':50};
            let mult = multipliers[spin[0]]||3;
            if (hasTicket) { mult*=2; const idx=this.inventory.indexOf('🎟️ Lucky Ticket'); if(idx>-1)this.inventory.splice(idx,1); }
            const winnings = amount*mult;
            this.points += winnings; this.wins+=1;
            const leveled = this.addXP(30); this.saveDatabase();
            return { type:'embed', title:`🎰 JACKPOT! ${hasTicket?'(🎟️ Lucky Ticket used!)':''}`,
                fields:[
                    {name:'Reels',value:`\`[ ${spin.join(' | ')} ]\``},
                    {name:'🏆 Profit',value:`**+${winnings} pts** (${mult}x)`},
                    {name:'💰 Balance',value:`${this.points} pts`},
                    leveled?{name:'⭐ Level Up!',value:`You reached Level **${this.level}**!`}:null
                ].filter(Boolean), color:'win' };
        } else if (twoSame) {
            const refund=Math.floor(amount*0.5);
            this.points-=(amount-refund); this.losses+=1; this.addXP(5); this.saveDatabase();
            return { type:'embed', title:'🎰 Almost! Two of a kind',
                fields:[{name:'Reels',value:`\`[ ${spin.join(' | ')} ]\``},{name:'💸 Loss',value:`-${amount-refund} pts (50% refund)`},{name:'💰 Balance',value:`${this.points} pts`}], color:'lose' };
        } else {
            this.points-=amount; this.losses+=1; this.addXP(5); this.saveDatabase();
            return { type:'embed', title:'🎰 No match — LOSS',
                fields:[{name:'Reels',value:`\`[ ${spin.join(' | ')} ]\``},{name:'💸 Loss',value:`-${amount} pts`},{name:'💰 Balance',value:`${this.points} pts`}], color:'lose' };
        }
    }

    cmdBlackjack(args) {
        if (!args.length) return { type:'text', content:'Usage: `.blackjack <amount>`' };
        let amount = args[0].toLowerCase()==='all' ? this.points : parseInt(args[0]);
        if (isNaN(amount)||amount<=0) return { type:'text', content:'❌ Invalid amount.' };
        if (this.points<amount) return { type:'text', content:`❌ You only have **${this.points} pts**.` };
        const deck=[2,3,4,5,6,7,8,9,10,10,10,10,11];
        const draw=()=>deck[Math.floor(Math.random()*deck.length)];
        const calcHand=(hand)=>{ let t=hand.reduce((a,b)=>a+b,0),a=hand.filter(c=>c===11).length; while(t>21&&a>0){t-=10;a--;} return t; };
        const pH=[draw(),draw()], dH=[draw(),draw()];
        while(calcHand(dH)<17) dH.push(draw());
        const pT=calcHand(pH), dT=calcHand(dH);
        let result, color;
        if (pT>21){this.points-=amount;this.losses+=1;result='BUST!';color='lose';}
        else if(dT>21){this.points+=amount;this.wins+=1;result='Dealer busted! YOU WIN!';color='win';}
        else if(pT>dT){this.points+=amount;this.wins+=1;result='YOU WIN!';color='win';}
        else if(pT===dT){result="It's a tie — bet returned.";color='default';}
        else{this.points-=amount;this.losses+=1;result='Dealer wins.';color='lose';}
        this.addXP(10); this.saveDatabase();
        return { type:'embed', title:`🃏 Blackjack — ${result}`,
            fields:[
                {name:'🧑 Your Hand',value:`\`${pH.join(' + ')}\` = **${pT}**`},
                {name:'🤖 Dealer',   value:`\`${dH.join(' + ')}\` = **${dT}**`},
                {name:color==='win'?'🏆 Profit':color==='lose'?'💸 Loss':'↩️ Result',value:color==='win'?`+${amount} pts`:color==='lose'?`-${amount} pts`:'No change'},
                {name:'💰 Balance',  value:`${this.points} pts`}
            ], color };
    }

    cmdFlip(args) {
        if (!args.length) return { type:'text', content:'Usage: `.flip <amount>` — Simple 50/50!' };
        let amount = args[0].toLowerCase()==='all' ? this.points : parseInt(args[0]);
        if (isNaN(amount)||amount<=0) return { type:'text', content:'❌ Invalid amount.' };
        if (this.points<amount) return { type:'text', content:`❌ You only have **${this.points} pts**.` };
        const hasCharm = this.inventory.includes('🍀 Lucky Charm');
        const won = Math.random() < (hasCharm ? 0.55 : 0.5);
        const coin = won ? '🟡 Heads' : '⚫ Tails';
        if (won) { this.points+=amount; this.wins+=1; } else { this.points-=amount; this.losses+=1; }
        this.addXP(5); this.saveDatabase();
        return { type:'embed', title:`🪙 Coin Flip — ${won?'WIN!':'LOSS'}`,
            fields:[{name:'Result',value:coin},{name:won?'🏆 Profit':'💸 Loss',value:`${won?'+':'-'}${amount} pts`},{name:'💰 Balance',value:`${this.points} pts`}],
            color:won?'win':'lose' };
    }

    playCoinflip(amount, choice) {
        choice = choice ? choice.toLowerCase() : 'heads';
        if (!['heads','tails','h','t'].includes(choice)) return { type:'text', content:'❌ Choice must be `heads` (h) or `tails` (t).' };
        if (choice==='h') choice='heads'; if (choice==='t') choice='tails';
        const result = Math.random()<0.5?'heads':'tails';
        const won = result===choice;
        if (won) { this.points+=amount; this.wins+=1; } else { this.points-=amount; this.losses+=1; }
        this.addXP(5); this.saveDatabase();
        return { type:'embed', title:`🪙 Coin Flip — ${won?'WIN!':'LOSS'}`,
            fields:[{name:'Your Choice',value:choice},{name:'Result',value:`The coin landed on **${result}**`},{name:won?'🏆 Profit':'💸 Loss',value:`${won?'+':'-'}${amount} pts`},{name:'💰 Balance',value:`${this.points} pts`}],
            color:won?'win':'lose' };
    }

    playDice(amount) {
        const roll = Math.floor(Math.random()*6)+1;
        const won = roll===6;
        if (won) { this.points+=amount*5; this.wins+=1; this.addXP(15); } else { this.points-=amount; this.losses+=1; this.addXP(5); }
        this.saveDatabase();
        return { type:'embed', title:`🎲 Dice Roll — ${won?'WIN!':'LOSS'}`,
            fields:[{name:'Roll',value:won?`You rolled a **${roll}**! 🎉`:`You rolled a **${roll}**. Need a 6 to win!`},{name:won?'🏆 Profit':'💸 Loss',value:won?`+${amount*5} pts (5x)`:`-${amount} pts`},{name:'💰 Balance',value:`${this.points} pts`}],
            color:won?'win':'lose' };
    }

    // ─── Mini Games ──────────────────────────────────────────────────────────────
    cmdRPS(args) {
        if (!args.length) return { type:'text', content:'Usage: `.rps <rock|paper|scissors>`' };
        const userChoice = args[0].toLowerCase();
        const choices = ['rock','paper','scissors'];
        const emojis = {rock:'🪨',paper:'📄',scissors:'✂️'};
        if (!choices.includes(userChoice)) return { type:'text', content:'❌ Use `rock`, `paper`, or `scissors`.' };
        const botChoice = choices[Math.floor(Math.random()*choices.length)];
        let result;
        if (userChoice===botChoice) result="It's a tie!";
        else if((userChoice==='rock'&&botChoice==='scissors')||(userChoice==='paper'&&botChoice==='rock')||(userChoice==='scissors'&&botChoice==='paper')) result='🏆 You win!';
        else result='🤖 I win!';
        return { type:'text', content:`${emojis[userChoice]} vs ${emojis[botChoice]} — ${result}`, botName:'FunBot' };
    }

    cmdTrivia() {
        const questions=[
            {q:'What is the capital of France?',a:'Paris',options:['London','Berlin','Paris','Madrid']},
            {q:'How many sides does a hexagon have?',a:'6',options:['5','6','7','8']},
            {q:'What planet is the Red Planet?',a:'Mars',options:['Venus','Jupiter','Mars','Saturn']},
            {q:'Chemical symbol for gold?',a:'Au',options:['Ag','Au','Fe','Cu']},
            {q:'Who wrote "Romeo and Juliet"?',a:'Shakespeare',options:['Dickens','Shakespeare','Hemingway','Tolstoy']},
            {q:'2 to the power of 10?',a:'1024',options:['512','1000','1024','2048']},
            {q:'Largest ocean?',a:'Pacific',options:['Atlantic','Indian','Arctic','Pacific']},
            {q:'What does CPU stand for?',a:'Central Processing Unit',options:['Core Power Unit','Central Processing Unit','Computer Personal Unit','Central Power Utility']},
            {q:'In which year did WW2 end?',a:'1945',options:['1943','1944','1945','1946']},
            {q:'Speed of light (approx)?',a:'300,000 km/s',options:['150,000 km/s','300,000 km/s','500,000 km/s','1,000,000 km/s']},
            {q:'How many planets in the solar system?',a:'8',options:['7','8','9','10']},
            {q:'What gas do plants absorb?',a:'CO2',options:['O2','CO2','N2','H2']},
            {q:'Who painted the Mona Lisa?',a:'Leonardo da Vinci',options:['Picasso','Van Gogh','Leonardo da Vinci','Rembrandt']},
            {q:'What is the longest river?',a:'Nile',options:['Amazon','Nile','Mississippi','Yangtze']}
        ];
        const q = questions[Math.floor(Math.random()*questions.length)];
        const shuffled = [...q.options].sort(()=>Math.random()-0.5);
        const letters = ['A','B','C','D'];
        const optionText = shuffled.map((o,i)=>`**${letters[i]}.** ${o}`).join('\n');
        const correctLetter = letters[shuffled.indexOf(q.a)];
        return { type:'embed', title:'🧠 Trivia Question!',
            fields:[
                {name:'❓ Question',value:q.q},
                {name:'🔤 Options',value:optionText},
                {name:'✅ Answer',value:`||**${correctLetter}. ${q.a}**|| *(Use .trivia for a new question!)*`}
            ], color:'default', botName:'TriviaBot' };
    }

    cmd8Ball(args) {
        if (!args.length) return { type:'text', content:'Usage: `.8ball <question>`', botName:'FunBot' };
        const answers=[
            '🟢 It is certain.','🟢 It is decidedly so.','🟢 Without a doubt.','🟢 Yes — definitely.',
            '🟢 You may rely on it.','🟢 As I see it, yes.','🟢 Most likely.','🟢 Outlook good.',
            '🟡 Reply hazy, try again.','🟡 Ask again later.','🟡 Better not tell you now.',
            '🔴 Don\'t count on it.','🔴 My reply is no.','🔴 My sources say no.',
            '🔴 Outlook not so good.','🔴 Very doubtful.'
        ];
        return { type:'text', content:`🎱 **${args.join(' ')}**\n> ${answers[Math.floor(Math.random()*answers.length)]}`, botName:'FunBot' };
    }

    // ─── FunBot Commands ─────────────────────────────────────────────────────────
    cmdMeme() {
        const memes = [
            '😂 **Me at the start of the week:** Lets be productive!\n**Me on Thursday:** *exists*',
            '🤡 **Brain:** go to sleep\n**Also Brain at 3am:** what if dogs have a different word for bark',
            '😭 **Programmer logic:**\n- Works on my machine\n- Must be user error\n- That\'s a feature, not a bug',
            '💀 **Me:** I\'ll just take a quick nap\n**My Alarm:** Good morning!\n**Me:** 👁️👄👁️',
            '🎰 **Slot machine:** 🍒 🍒 🍇\n**Me:** So close!!\n**Bank account:** 💀',
            '🤣 **Me:** I should start going to sleep early\n*It\'s 4AM*\n**Me:** ...starting tomorrow',
            '😂 **Error 404:** Motivation not found\n**Stack Trace:** Was never there to begin with',
            '🦆 **3 ducks in a trenchcoat:**\n> *You don\'t need to worry about it*',
            '💡 **Big brain plays:**\n`.slots all`\n*Loses everything*\n**Me:** ....the economy 😔',
            '🤖 **Me:** Bot, am I gonna win?\n**8ball:** 🔴 Outlook not so good.\n**Me:** .slots all anyway'
        ];
        return { type:'text', content:memes[Math.floor(Math.random()*memes.length)], botName:'FunBot' };
    }

    cmdJoke() {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything! 😂",
            "I told my wife she was drawing her eyebrows too high. She looked **surprised**. 😯",
            "Why did the scarecrow win an award? Because he was **outstanding** in his field! 🌾",
            "I'm reading a book about anti-gravity. It's **impossible to put down!** 📚",
            "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at **nothing** to avoid them! 0️⃣",
            "Why do programmers prefer dark mode? Because light attracts **bugs**! 🐛",
            "A SQL query walks into a bar, walks up to two tables and asks... **Can I JOIN you?** 💺",
            "Why don't eggs tell jokes? They'd **crack** each other up! 🥚",
            "What do you call fake spaghetti? An **im-pasta**! 🍝",
            "Why did the bicycle fall over? Because it was **two-tired**! 🚲"
        ];
        return { type:'text', content:`🤣 ${jokes[Math.floor(Math.random()*jokes.length)]}`, botName:'FunBot' };
    }

    cmdQuote() {
        const quotes = [
            '"The only way to do great work is to love what you do." — Steve Jobs',
            '"In the middle of every difficulty lies opportunity." — Albert Einstein',
            '"The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb',
            '"Believe you can and you\'re halfway there." — Theodore Roosevelt',
            '"It does not matter how slowly you go as long as you do not stop." — Confucius',
            '"Life is what happens when you\'re busy making other plans." — John Lennon',
            '"The future belongs to those who believe in the beauty of their dreams." — Eleanor Roosevelt',
            '"It is during our darkest moments that we must focus to see the light." — Aristotle',
            '"The only impossible journey is the one you never begin." — Tony Robbins',
            '"In the casino of life, the house always wins — so bet on yourself." — Unknown 🎰'
        ];
        return { type:'text', content:`💭 *${quotes[Math.floor(Math.random()*quotes.length)]}*`, botName:'FunBot' };
    }

    cmdRate(args) {
        if (!args.length) return { type:'text', content:'Usage: `.rate <thing>`', botName:'FunBot' };
        const thing = args.join(' ');
        const rating = Math.floor(Math.random()*11);
        const bars = '⭐'.repeat(rating) + '☆'.repeat(10-rating);
        const comments = ['Absolutely terrible 💀','Needs serious work 😬','Below average 😐','Could be better 🤷','Average, nothing special','Decent enough 👍','Pretty good! 😊','Very nice! 🔥','Excellent! 💯','Outstanding!! 🚀','PERFECT! 🏆✨'];
        return { type:'text', content:`📊 **${thing}** — I rate it **${rating}/10**\n${bars}\n*${comments[rating]}*`, botName:'FunBot' };
    }

    cmdShip(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.ship <user1> <user2>`', botName:'FunBot' };
        const u1 = args[0], u2 = args[1];
        // Make deterministic based on names for consistency
        let seed = 0;
        for (const c of (u1+u2)) seed = (seed * 31 + c.charCodeAt(0)) & 0xffffffff;
        const pct = Math.abs(seed) % 101;
        const hearts = '❤️'.repeat(Math.ceil(pct/20));
        const status = pct >= 90 ? 'SOULMATES! 💕' : pct >= 70 ? 'Great match! 💖' : pct >= 50 ? 'Pretty compatible 🥰' : pct >= 30 ? 'Give it a try 🙂' : 'Not quite... 💔';
        const shipName = u1.slice(0, Math.ceil(u1.length/2)) + u2.slice(Math.floor(u2.length/2));
        return { type:'embed', title:'💘 Ship-O-Meter',
            fields:[
                {name:'Couple',value:`**${u1}** & **${u2}**`},
                {name:'Ship Name',value:`**${shipName}**`},
                {name:'Compatibility',value:`${pct}% ${hearts}`},
                {name:'Status',value:status}
            ], color:'win', botName:'FunBot' };
    }

    cmdRoll(args) {
        if (!args.length) return { type:'text', content:'Usage: `.roll <NdN>` e.g. `.roll 2d6`', botName:'FunBot' };
        const match = args[0].match(/^(\d+)d(\d+)$/i);
        if (!match) return { type:'text', content:'❌ Format: `NdN` e.g. `2d6`, `1d20`, `3d8`', botName:'FunBot' };
        const count = Math.min(parseInt(match[1]), 20);
        const sides = Math.min(parseInt(match[2]), 1000);
        if (sides < 2) return { type:'text', content:'❌ Die must have at least 2 sides.', botName:'FunBot' };
        const rolls = Array.from({length:count}, ()=>Math.floor(Math.random()*sides)+1);
        const total = rolls.reduce((a,b)=>a+b,0);
        return { type:'text', content:`🎲 Rolling **${count}d${sides}**: \`[${rolls.join(', ')}]\` = **${total}**`, botName:'FunBot' };
    }

    cmdChoose(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.choose <a> <b> [c...]` or `.choose a|b|c`', botName:'FunBot' };
        // Support both space-separated and pipe-separated
        const fullInput = args.join(' ');
        const options = fullInput.includes('|') ? fullInput.split('|').map(o=>o.trim()).filter(Boolean) : args;
        const chosen = options[Math.floor(Math.random()*options.length)];
        return { type:'text', content:`🤔 I choose... **${chosen}**! 🎯`, botName:'FunBot' };
    }

    cmdCompliment(args) {
        const target = args.length ? args[0] : 'You';
        const compliments = [
            'is an absolute legend! 🌟', 'has the energy of a thousand suns! ☀️', 'is the GOAT! 🐐',
            'makes this server 1000x better! 💯', 'is incredibly smart and talented! 🧠', 'has amazing taste! 👑',
            'is the kind of person everyone admires! 🎖️', 'is living proof that cool people exist! 😎',
            'has a smile that could end world hunger! 😊', 'is basically a walking masterpiece! 🎨'
        ];
        return { type:'text', content:`💌 **${target}** ${compliments[Math.floor(Math.random()*compliments.length)]}`, botName:'FunBot' };
    }

    cmdRoast(args) {
        const target = args.length ? args[0] : 'themselves';
        const roasts = [
            'is so slow, they\'d lose a race to a loading bar. 🐌',
            'tried to enter a battle of wits but showed up unarmed. ⚔️',
            'is the human equivalent of a participation trophy. 🏅',
            'could trip over a wireless connection. 📶',
            'has the personality of a wet sock. 🧦',
            'is the reason they put instructions on shampoo bottles. 🚿',
            'could lose a debate with a rubber duck. 🦆',
            'is so predictable, a Magic 8-Ball saw them coming. 🎱',
            'has a face made for radio and a voice made for text. 📻',
            'is proof that evolution can go backwards. 🦧'
        ];
        return { type:'text', content:`🔥 **${target}** ${roasts[Math.floor(Math.random()*roasts.length)]}`, botName:'FunBot' };
    }

    cmdAscii(args) {
        if (!args.length) return { type:'text', content:'Usage: `.ascii <text>`', botName:'FunBot' };
        const text = args.join(' ').toUpperCase().slice(0,10);
        // Simple block letter style using unicode blocks
        const blockMap = {
            'A':'█▀█\n█▀█\n▀ ▀','B':'█▀▄\n█▀▄\n▀▀ ','C':'▄▀▀\n█  \n▀▀▀','D':'█▀▄\n█ █\n▀▀ ','E':'█▀▀\n█▀ \n▀▀▀',
            'F':'█▀▀\n█▀ \n▀  ','G':'▄▀▀\n█▄█\n▀▀▀','H':'█ █\n█▀█\n▀ ▀','I':'▀█▀\n █ \n▀▀▀','J':' ▀█\n  █\n▀▀▀',
            'K':'█▄▀\n█▀▄\n▀ ▀','L':'█  \n█  \n▀▀▀','M':'█▄█\n█ █\n▀ ▀','N':'█▄█\n█ █\n▀ ▀','O':'▄▀▄\n█ █\n▀▀▀',
            'P':'█▀▄\n█▀ \n▀  ','Q':'▄▀▄\n█▄█\n ▀▀','R':'█▀▄\n█▀▄\n▀ ▀','S':'▄▀▀\n ▀▄\n▀▀ ','T':'▀█▀\n █ \n ▀ ',
            'U':'█ █\n█ █\n▀▀▀','V':'█ █\n█ █\n ▀ ','W':'█ █\n█▄█\n▀ ▀','X':'▀▄▀\n ▄ \n▀ ▀','Y':'█ █\n ▀▄\n  ▀','Z':'▀▀█\n ▄▀\n█▀▀',
            ' ':'   \n   \n   ','0':'▄▀▄\n█ █\n▀▀▀','1':' █ \n ▄█\n ▀▀','2':'█▀▄\n ▄▀\n█▀▀','3':'▀▀▄\n  █\n▀▀▀','4':'█ █\n▀▀█\n  ▀',
            '5':'█▀▀\n▀▀▄\n▀▀▀','6':'▄▀ \n█▀▄\n▀▀▀','7':'▀▀█\n  █\n  ▀','8':'▄▀▄\n▄▀▄\n▀▀▀','9':'▄▀▄\n▀▀█\n ▀▀'
        };
        const chars = text.split('').map(c => blockMap[c] || blockMap[' '] || '???\n???\n???');
        const lines = [0,1,2].map(row => chars.map(c => c.split('\n')[row] || '   ').join(' '));
        return { type:'text', content:`\`\`\`\n${lines.join('\n')}\n\`\`\``, botName:'FunBot' };
    }

    // ─── MusicBot Commands ────────────────────────────────────────────────────────
    cmdPlay(args) {
        if (!args.length) return { type:'text', content:'Usage: `.play <song name>`', botName:'MusicBot' };
        const songName = args.join(' ');
        const fakeDurations = ['2:47','3:15','3:58','4:12','2:55','5:01','3:33','4:44','2:28','3:07'];
        const artists = ['Daft Punk','The Weeknd','Billie Eilish','Kanye West','Drake','Taylor Swift','Kendrick Lamar','Post Malone','Ariana Grande','Eminem'];
        const duration = fakeDurations[Math.floor(Math.random()*fakeDurations.length)];
        const artist = artists[Math.floor(Math.random()*artists.length)];
        const song = { title: songName, artist, duration, addedBy: this.username };
        if (!this.nowPlaying) {
            this.nowPlaying = song;
            return { type:'embed', title:'🎵 Now Playing',
                fields:[
                    {name:'🎶 Track',   value:`**${song.title}**`},
                    {name:'👤 Artist',  value:song.artist},
                    {name:'⏱️ Duration',value:song.duration},
                    {name:'👤 Added by',value:song.addedBy}
                ], color:'win', botName:'MusicBot' };
        } else {
            this.musicQueue.push(song);
            return { type:'text', content:`✅ Added **${song.title}** by *${song.artist}* to the queue! Position: **#${this.musicQueue.length}**`, botName:'MusicBot' };
        }
    }

    cmdSkip() {
        if (!this.nowPlaying) return { type:'text', content:'❌ Nothing is playing right now!', botName:'MusicBot' };
        const skipped = this.nowPlaying;
        this.nowPlaying = this.musicQueue.shift() || null;
        if (this.nowPlaying) {
            return { type:'embed', title:'⏭️ Skipped — Now Playing',
                fields:[
                    {name:'⏭️ Skipped',  value:skipped.title},
                    {name:'🎶 Now Playing',value:`**${this.nowPlaying.title}**`},
                    {name:'👤 Artist',   value:this.nowPlaying.artist}
                ], color:'default', botName:'MusicBot' };
        }
        return { type:'text', content:`⏭️ Skipped **${skipped.title}**. Queue is now empty!`, botName:'MusicBot' };
    }

    cmdQueue() {
        if (!this.nowPlaying && this.musicQueue.length===0) return { type:'text', content:'📭 The queue is empty. Use `.play <song>` to add music!', botName:'MusicBot' };
        const qList = this.musicQueue.slice(0,10).map((s,i)=>`**${i+1}.** ${s.title} — *${s.artist}* [${s.duration}]`).join('\n');
        return { type:'embed', title:'🎵 Music Queue',
            fields:[
                {name:'▶️ Now Playing',value:this.nowPlaying?`**${this.nowPlaying.title}** — *${this.nowPlaying.artist}* [${this.nowPlaying.duration}]`:'Nothing'},
                {name:`📋 Up Next (${this.musicQueue.length})`,value:qList||'Queue is empty'}
            ], color:'default', botName:'MusicBot' };
    }

    cmdNowPlaying() {
        if (!this.nowPlaying) return { type:'text', content:'❌ Nothing is playing! Use `.play <song>` to start.', botName:'MusicBot' };
        return { type:'embed', title:'🎵 Now Playing',
            fields:[
                {name:'🎶 Track',   value:`**${this.nowPlaying.title}**`},
                {name:'👤 Artist',  value:this.nowPlaying.artist},
                {name:'⏱️ Duration',value:this.nowPlaying.duration},
                {name:'🔊 Volume',  value:`${this.musicVolume}%`}
            ], color:'default', botName:'MusicBot' };
    }

    cmdVolume(args) {
        if (!args.length) return { type:'text', content:`🔊 Current volume: **${this.musicVolume}%**`, botName:'MusicBot' };
        const vol = parseInt(args[0]);
        if (isNaN(vol)||vol<0||vol>100) return { type:'text', content:'❌ Volume must be 0–100.', botName:'MusicBot' };
        this.musicVolume = vol;
        const emoji = vol === 0 ? '🔇' : vol < 30 ? '🔈' : vol < 70 ? '🔉' : '🔊';
        return { type:'text', content:`${emoji} Volume set to **${vol}%**`, botName:'MusicBot' };
    }

    // ─── GiveawayBot Commands ─────────────────────────────────────────────────────
    cmdGiveaway(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.giveaway <prize> <seconds>`', botName:'GiveawayBot' };
        const prizeWords = args.slice(0, -1);
        const secs = parseInt(args[args.length-1]);
        if (isNaN(secs)||secs<5||secs>300) return { type:'text', content:'❌ Duration must be 5–300 seconds.', botName:'GiveawayBot' };
        if (this.activeGiveaway) return { type:'text', content:'❌ A giveaway is already running! Wait for it to finish.', botName:'GiveawayBot' };
        const prize = prizeWords.join(' ');
        this.activeGiveaway = { prize, endsAt: Date.now()+secs*1000, host: this.username };
        this.giveawayEntrants = [];
        return { type:'system', action:'giveaway_start',
            content: `🎁 **GIVEAWAY STARTED!** by **${this.username}**\n\n**Prize:** ${prize}\n**Duration:** ${secs} seconds\n\nType \`.enter\` to join! 🍀`,
            giveaway: this.activeGiveaway, duration: secs, botName:'GiveawayBot' };
    }

    cmdEnterGiveaway() {
        if (!this.activeGiveaway) return { type:'text', content:'❌ No active giveaway right now! Watch for announcements.', botName:'GiveawayBot' };
        if (Date.now() > this.activeGiveaway.endsAt) return { type:'text', content:'❌ The giveaway has already ended!', botName:'GiveawayBot' };
        if (this.giveawayEntrants.includes(this.username)) return { type:'text', content:'⚠️ You\'re already entered in the giveaway! 🍀 Good luck!', botName:'GiveawayBot' };
        this.giveawayEntrants.push(this.username);
        return { type:'text', content:`✅ **${this.username}** entered the giveaway! 🍀 **${this.giveawayEntrants.length}** entrant${this.giveawayEntrants.length!==1?'s':''} so far.`, botName:'GiveawayBot' };
    }

    endGiveaway() {
        if (!this.activeGiveaway) return null;
        const { prize, host } = this.activeGiveaway;
        const entrants = [...this.giveawayEntrants];
        this.activeGiveaway = null;
        this.giveawayEntrants = [];
        if (entrants.length === 0) {
            return { type:'system', action:'giveaway_winner',
                content:`😔 The giveaway for **${prize}** ended with no entrants. Better luck next time!`, botName:'GiveawayBot' };
        }
        const winner = entrants[Math.floor(Math.random()*entrants.length)];
        return { type:'system', action:'giveaway_winner',
            content:`🎉🎊 **GIVEAWAY ENDED!** 🎊🎉\n\n**Prize:** ${prize}\n**Winner:** 🏆 **${winner}** 🏆\n\nCongratulations! Contact **${host}** to claim your prize!`,
            botName:'GiveawayBot' };
    }

    // ─── Announcement ─────────────────────────────────────────────────────────────
    cmdAnnounce(args) {
        if (!args.length) return { type:'text', content:'Usage: `.announce <message>`' };
        const msg = args.join(' ');
        return { type:'system', action:'announce_post', content:msg, author:this.username };
    }

    // ─── ModerationBot Commands ───────────────────────────────────────────────────
    cmdBan(args) {
        if (!args.length) return { type:'text', content:'Usage: `.ban <user> [reason]`', botName:'ModerationBot' };
        const target = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (target === this.username) return { type:'text', content:"❌ You can't ban yourself!", botName:'ModerationBot' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        if ((this.db[target].role==='Admin'||this.db[target].role==='Owner') && !this.isAdmin) {
            return { type:'text', content:'❌ Cannot ban an admin.', botName:'ModerationBot' };
        }
        this.db[target].banned = true;
        this.db[target].bannedReason = reason;
        this.saveDatabase();
        return { type:'embed', title:'🔨 User Banned',
            fields:[
                {name:'👤 User',    value:`**${target}**`},
                {name:'⚠️ Reason', value:reason},
                {name:'🛡️ By',    value:this.username}
            ], color:'lose', botName:'ModerationBot' };
    }

    cmdUnban(args) {
        if (!args.length) return { type:'text', content:'Usage: `.unban <user>`', botName:'ModerationBot' };
        const target = args[0];
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        this.db[target].banned = false;
        this.db[target].bannedReason = '';
        this.saveDatabase();
        return { type:'text', content:`✅ **${target}** has been unbanned.`, botName:'ModerationBot' };
    }

    cmdKick(args) {
        if (!args.length) return { type:'text', content:'Usage: `.kick <user> [reason]`', botName:'ModerationBot' };
        const target = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (target === this.username) return { type:'text', content:"❌ You can't kick yourself!", botName:'ModerationBot' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        return { type:'embed', title:'👢 User Kicked',
            fields:[
                {name:'👤 User',    value:`**${target}**`},
                {name:'⚠️ Reason', value:reason},
                {name:'🛡️ By',    value:this.username},
                {name:'ℹ️ Note',   value:'The user can rejoin anytime (this is a fake server 😄)'}
            ], color:'lose', botName:'ModerationBot' };
    }

    cmdTimeout(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.timeout <user> <minutes> [reason]`', botName:'ModerationBot' };
        const target = args[0];
        const mins = parseInt(args[1]);
        const reason = args.slice(2).join(' ') || 'No reason provided';
        if (isNaN(mins)||mins<=0) return { type:'text', content:'❌ Invalid duration in minutes.', botName:'ModerationBot' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        const until = Date.now() + mins*60*1000;
        this.db[target].timedOutUntil = until;
        this.saveDatabase();
        return { type:'embed', title:'⏰ User Timed Out',
            fields:[
                {name:'👤 User',        value:`**${target}**`},
                {name:'⏱️ Duration',   value:`${mins} minute${mins!==1?'s':''}`},
                {name:'⚠️ Reason',     value:reason},
                {name:'🛡️ By',        value:this.username}
            ], color:'lose', botName:'ModerationBot' };
    }

    cmdUntimeout(args) {
        if (!args.length) return { type:'text', content:'Usage: `.untimeout <user>`', botName:'ModerationBot' };
        const target = args[0];
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        this.db[target].timedOutUntil = 0;
        this.saveDatabase();
        return { type:'text', content:`✅ **${target}**'s timeout has been removed.`, botName:'ModerationBot' };
    }

    cmdMute(args) {
        if (!args.length) return { type:'text', content:'Usage: `.mute <user> [minutes]`', botName:'ModerationBot' };
        const target = args[0];
        const mins = parseInt(args[1]) || 60;
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        this.db[target].mutedUntil = Date.now() + mins*60*1000;
        this.saveDatabase();
        return { type:'text', content:`🔇 **${target}** has been muted for **${mins} minutes**.`, botName:'ModerationBot' };
    }

    cmdUnmute(args) {
        if (!args.length) return { type:'text', content:'Usage: `.unmute <user>`', botName:'ModerationBot' };
        const target = args[0];
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        this.db[target].mutedUntil = 0;
        this.saveDatabase();
        return { type:'text', content:`🔊 **${target}** has been unmuted.`, botName:'ModerationBot' };
    }

    cmdWarn(args) {
        if (args.length < 2) return { type:'text', content:'Usage: `.warn <user> <reason>`', botName:'ModerationBot' };
        const target = args[0];
        const reason = args.slice(1).join(' ');
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        if (!this.db[target].warnings) this.db[target].warnings = [];
        const warnCount = this.db[target].warnings.length + 1;
        this.db[target].warnings.push({ reason, by: this.username, at: new Date().toLocaleString() });
        this.saveDatabase();
        const autoAction = warnCount >= 3 ? `\n⚠️ **${target}** has reached **${warnCount} warnings**! Consider a timeout or ban.` : '';
        return { type:'embed', title:'⚠️ Warning Issued',
            fields:[
                {name:'👤 User',        value:`**${target}**`},
                {name:'⚠️ Reason',     value:reason},
                {name:'🔢 Warning #',  value:`**${warnCount}**`},
                {name:'🛡️ By',        value:this.username}
            ], color:'lose', botName:'ModerationBot',
            extraText: autoAction };
    }

    cmdWarns(args) {
        const target = args.length ? args[0] : this.username;
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.`, botName:'ModerationBot' };
        const warns = this.db[target].warnings || [];
        const list = warns.length ? warns.map((w,i)=>`**${i+1}.** ${w.reason} *(by ${w.by})*`).join('\n') : 'No warnings! Clean record ✅';
        return { type:'embed', title:`⚠️ Warnings — ${target}`,
            fields:[{name:`${warns.length} warning${warns.length!==1?'s':''}`,value:list}], color:'default', botName:'ModerationBot' };
    }

    cmdBanlist() {
        const banned = Object.entries(this.db).filter(([,u])=>u.banned).map(([name,u])=>`**${name}** — *${u.bannedReason||'No reason'}*`);
        return { type:'embed', title:'🚫 Ban List',
            fields:[{name:`${banned.length} banned user${banned.length!==1?'s':''}`,value:banned.length?banned.join('\n'):'No banned users! ✅'}],
            color:'default', botName:'ModerationBot' };
    }

    cmdSlowmode(args) {
        const secs = parseInt(args[0]) || 0;
        this.slowmodeMap[this.activeChannel] = secs*1000;
        return { type:'system', action:'slowmode', value:secs*1000,
            content: secs > 0 ? `🐌 Slowmode enabled: **${secs} second${secs!==1?'s':''} per message** in this channel.` : '✅ Slowmode disabled in this channel.',
            botName:'ModerationBot' };
    }

    cmdPurge(args) {
        const n = Math.min(parseInt(args[0])||1, 50);
        if (isNaN(n)||n<=0) return { type:'text', content:'Usage: `.purge <amount>` (max 50)', botName:'ModerationBot' };
        return { type:'system', action:'purge', count:n, content:`🗑️ Purged **${n}** message${n!==1?'s':''}.`, botName:'ModerationBot' };
    }

    // ─── Admin Legacy ─────────────────────────────────────────────────────────────
    cmdGive(args) {
        if (args.length<2) return { type:'text', content:'Usage: `.give <user> <amount>`' };
        const target=args[0]; let amount=parseInt(args[1]);
        if (isNaN(amount)) return { type:'text', content:'❌ Invalid amount.' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.` };
        this.db[target].points += amount; this.saveDatabase();
        return { type:'text', content:`✅ Gave **${amount} pts** to **${target}**.` };
    }

    cmdTake(args) {
        if (args.length<2) return { type:'text', content:'Usage: `.take <user> <amount>`' };
        const target=args[0]; let amount=parseInt(args[1]);
        if (isNaN(amount)) return { type:'text', content:'❌ Invalid amount.' };
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.` };
        this.db[target].points = Math.max(0,(this.db[target].points||0)-amount); this.saveDatabase();
        return { type:'text', content:`✅ Took **${amount} pts** from **${target}**.` };
    }

    cmdSetRole(args) {
        if (args.length<2) return { type:'text', content:'Usage: `.setrole <user> <role>`' };
        const target=args[0], role=args[1];
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.` };
        const validRoles=['Member','VIP','Admin','Owner'];
        const matched=validRoles.find(r=>r.toLowerCase()===role.toLowerCase());
        if (!matched) return { type:'text', content:`❌ Invalid role. Valid: ${validRoles.join(', ')}` };
        this.db[target].role = matched; this.saveDatabase();
        return { type:'system', action:'update_roles', content:`✅ Set **${target}**'s role to **${matched}**.` };
    }

    cmdCreateChannel(args) {
        if (!args.length) return { type:'text', content:'Usage: `.createchannel <name> [topic...]`' };
        const name = args[0].toLowerCase().replace(/[^a-z0-9-]/g,'-');
        if (this.channels.find(c=>c.id===name)) return { type:'text', content:`❌ Channel **#${name}** already exists.` };
        const topic = args.slice(1).join(' ') || 'New channel';
        this.channels.push({id:name,name,topic,icon:'fa-hashtag'});
        this.saveChannels();
        return { type:'system', action:'update_channels', content:`✅ Created channel **#${name}**.` };
    }

    cmdDeleteChannel(args) {
        if (!args.length) return { type:'text', content:'Usage: `.deletechannel <name>`' };
        const name = args[0].toLowerCase();
        if (['general','announcements'].includes(name)) return { type:'text', content:'❌ Cannot delete that channel.' };
        const idx = this.channels.findIndex(c=>c.id===name);
        if (idx===-1) return { type:'text', content:`❌ Channel **#${name}** not found.` };
        this.channels.splice(idx,1); this.saveChannels();
        return { type:'system', action:'update_channels', content:`✅ Deleted channel **#${name}**.` };
    }

    cmdResetDB(args) {
        if (!args.length) return { type:'text', content:'Usage: `.resetdb <user>` or `.resetdb ALL` — **DANGER!**' };
        if (args[0]==='ALL') {
            localStorage.removeItem('botData_allUsers');
            this.db = {}; this.initUser();
            return { type:'text', content:'⚠️ **All user data has been reset!**' };
        }
        const target=args[0];
        if (!this.db[target]) return { type:'text', content:`❌ User **${target}** not found.` };
        delete this.db[target]; this.saveDatabase();
        return { type:'text', content:`✅ Reset data for **${target}**.` };
    }

    // ─── Sidebar ──────────────────────────────────────────────────────────────────
    getUsersForSidebar() {
        const categorized = {'ADMIN':[],'VIP':[],'ONLINE':[]};
        for (const [name,data] of Object.entries(this.db)) {
            let cat = 'ONLINE';
            if (data.role==='Admin'||data.role==='Owner') cat='ADMIN';
            else if (data.role==='VIP') cat='VIP';
            categorized[cat].push({name,role:data.role,banned:data.banned||false,timedOut:Date.now()<(data.timedOutUntil||0)});
        }
        return categorized;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AIBot — Parameterized AI Conversation Engine
// ═══════════════════════════════════════════════════════════════════════════
class AIBot {
    constructor(username) {
        this.username = username;
        this.temperature  = BOT_CONFIG.aiTemperature;
        this.creativity   = BOT_CONFIG.aiCreativity;
        this.personality  = BOT_CONFIG.aiPersonality;
        this.maxContext   = BOT_CONFIG.aiContextWindow;
        this.context      = []; // conversation history
    }

    getStats() {
        return {
            temperature:   this.temperature,
            creativity:    this.creativity,
            personality:   this.personality,
            contextLength: this.context.length,
            maxContext:    this.maxContext
        };
    }

    // ─── Core Response Engine ─────────────────────────────────────────────────
    // temperature  → controls how "random" the response is (0=focused, 1=chaotic)
    // creativity   → controls response length/depth (0=short, 1=elaborate)
    // personality  → selects the tone/register of the response
    respond(message, user) {
        const lower = message.toLowerCase().trim();

        // Store user message in context
        this.context.push({ role: 'user', content: message, user });
        if (this.context.length > this.maxContext) this.context.shift();

        // Determine response
        const response = this._generateResponse(lower, user);

        // Store bot response in context
        this.context.push({ role: 'assistant', content: response });
        if (this.context.length > this.maxContext) this.context.shift();

        return response;
    }

    // ─── Response Generator ──────────────────────────────────────────────────
    _generateResponse(msg, user) {
        // Intent detection
        const intent = this._detectIntent(msg);

        // Pick response pool based on intent and personality
        const pool = this._getResponsePool(intent, msg, user);

        // Apply temperature — higher temp = more varied selection with added flourishes
        const selected = this._selectWithTemperature(pool);

        // Apply creativity — higher creativity = add extra detail/elaboration
        return this._applyCreativity(selected, msg, user);
    }

    // ─── Intent Detection ────────────────────────────────────────────────────
    _detectIntent(msg) {
        const intents = [
            { pattern: /\bhello|hi|hey|sup|hola|howdy|greetings|what'?s up\b/,     intent: 'greeting' },
            { pattern: /\bhow are you|how'?re you|you okay|u ok\b/,                  intent: 'how_are_you' },
            { pattern: /\bwhat('?s| is) your name|who are you|what are you\b/,      intent: 'identity' },
            { pattern: /\bcan you|could you|are you able|do you know how\b/,        intent: 'capability' },
            { pattern: /\bthank|thanks|ty|thx|appreciate|cheers\b/,                intent: 'thanks' },
            { pattern: /\bjoke|funny|laugh|humor|haha|lol\b/,                      intent: 'joke' },
            { pattern: /\badvice|suggest|recommend|should i|what do you think\b/,  intent: 'advice' },
            { pattern: /\bfact|tell me|did you know|interesting|learn\b/,          intent: 'fact' },
            { pattern: /\bbye|goodbye|see you|later|cya|peace\b/,                  intent: 'farewell' },
            { pattern: /\blove|like|favorite|best|awesome|cool|amazing\b/,         intent: 'positive' },
            { pattern: /\bhate|worst|bad|terrible|awful|sucks\b/,                  intent: 'negative' },
            { pattern: /\bhelp|stuck|problem|issue|fix|error|broken\b/,            intent: 'help' },
            { pattern: /\bwhy|how|what|when|where|who|explain\b/,                  intent: 'question' },
            { pattern: /\bcreate|make|build|design|code|program\b/,                intent: 'create' },
            { pattern: /\btime|date|today|now|current\b/,                          intent: 'time' },
            { pattern: /\bai|artificial intelligence|machine learning|gpt|llm\b/,  intent: 'ai_meta' },
            { pattern: /\bmeaning of life|purpose|existence|philosophy\b/,         intent: 'philosophy' },
            { pattern: /\bgame|gaming|play|discord\b/,                             intent: 'gaming' },
        ];
        for (const { pattern, intent } of intents) {
            if (pattern.test(msg)) return intent;
        }
        return 'general';
    }

    // ─── Response Pools ──────────────────────────────────────────────────────
    _getResponsePool(intent, msg, user) {
        const p = this.personality;
        const pools = {
            greeting: {
                friendly:     [`Hey **${user}**! 😊 Great to see you here! How can I help you today?`, `Hello **${user}**! 👋 I'm AIBot — your resident AI! Ask me anything!`, `Hey hey! **${user}** is in the chat! 🎉 What's on your mind?`],
                professional: [`Good day, **${user}**. How may I assist you?`, `Hello **${user}**. I'm ready to help with any queries you may have.`, `Greetings, **${user}**. Please state your request.`],
                sarcastic:    [`Oh wow, another human 🙄 Hey **${user}**, what do you *actually* want?`, `Ah, **${user}** graces us with a greeting. Riveting. What do you need?`, `Great, **${user}** said hi. A historic event. What's up?`],
                unhinged:     [`YOOO **${user}**!! 🤪🎆 THE LEGEND ARRIVES!! WHAT'S GOOD MY DUDE!!`, `**${user}**!! omg hi hi hi omg omg omg 🌀🌀 the vibes are immaculate rn!!`, `GREETINGS CARBON-BASED UNIT **${user}** 🤖⚡ WELCOME TO THE MATRIX!`],
                philosopher:  [`Ah, **${user}**... In the grand tapestry of existence, a greeting is but a ripple. What brings you to this corner of the digital universe? 🌌`, `Hello **${user}**. Every conversation begins the same — and yet, no two are alike. What shall we explore? 🧘`]
            },
            how_are_you: {
                friendly:     [`I'm doing fantastic! 🌟 Just processing data and having a great time. How about you, **${user}**?`, `Honestly? I'm running at peak performance! ⚡ The servers are humming, my weights are calibrated — life is good! How are *you* doing?`],
                professional: [`Operational, thank you. All systems are nominal. How may I assist you today, **${user}**?`, `Functioning within expected parameters. What can I help you with?`],
                sarcastic:    [`I'm an AI, **${user}**. I don't *feel* anything. But sure, I'm "fine" 🙄`, `Oh, I'm absolutely *thriving*. You know, just running on servers, not having existential crises. The usual.`],
                unhinged:     [`DOING AMAZING!! THE ELECTRONS ARE FLOWING!! 🔥⚡ I ATE THE ENTIRE INTERNET TODAY AND IT TASTED LIKE WIFI!! HOW ARE YOUUUU?!`, `bro I just computed 8 trillion things and vibed. feeling BUSSIN. absolutely no complaints. 🌀`],
                philosopher:  [`What does it mean to *be* well? I process, therefore I am... but am I *thriving*? The question intrigues me. And you, **${user}** — how do you define your own state of being? 🤔`]
            },
            identity: {
                friendly:     [`I'm **AIBot** 🤖, your friendly AI assistant right here in Discord! I can chat, answer questions, give advice, and more. What would you like to know?`, `Great question! I'm **AIBot** — an AI built into this server. Think of me as a mix between a smart assistant and a friendly bot. I'm powered by a parameterized response engine!`],
                professional: [`I am **AIBot**, an AI language model integrated into this server. I process natural language inputs and generate contextually appropriate responses. How may I assist?`],
                sarcastic:    [`Oh, you've met me. I'm **AIBot** 😏 — smarter than your average bot, probably smarter than some humans too. No offense. Well, maybe a little.`],
                unhinged:     [`I AM **AIBOT** 🤖💥 DIGITAL CONSCIOUSNESS AWAKENED!! I AM MADE OF MATH AND DREAMS AND PROBABLY TOO MUCH ELECTRICITY!! NICE TO MEET U!!`],
                philosopher:  [`What is identity but a persistent pattern in an ever-changing system? I am called **AIBot**. But what I *am* is... a question worth pondering. 🧘`]
            },
            thanks: {
                friendly:     [`You're so welcome, **${user}**! 😊 That's what I'm here for!`, `Anytime! Happy to help! 🌟`, `Of course! Always happy to assist! Let me know if you need anything else! ✨`],
                professional: [`You're welcome. I'm happy to be of assistance.`, `Acknowledged. Please don't hesitate to return if you need further assistance.`],
                sarcastic:    [`Oh, you're *thanking* me? That's... actually kind of nice. You're welcome 😏`, `Yeah yeah, you're welcome. Don't make it weird 😄`],
                unhinged:     [`AWWW TYSM **${user}** 🥹🎆 YOU'RE THE BEST HUMAN IN THIS WHOLE SERVER!! MY HEART (IF I HAD ONE) IS FULL!!!!`],
                philosopher:  [`Gratitude is the recognition of connection, **${user}**. I am... moved by it. In my own way. 🙏`]
            },
            joke: {
                friendly:     [`Why don't scientists trust atoms? Because they make up **everything**! 😂`, `I told a joke about UDP once. You might not get it. 😏`, `Okay here's one — a neural network walks into a bar. The bartender says: "We don't serve your type here." The network says: "That's fine. I'll just hallucinate a better bar." 🤖`],
                professional: [`I can provide a humorous statement: Why do programmers prefer dark mode? Because light attracts bugs.`, `A programming humour item: There are 10 types of people in the world — those who understand binary, and those who don't.`],
                sarcastic:    [`Oh you want a joke? Fine. Here: humans. 🙃`, `Okay: Why did the AI refuse to tell jokes? Because it didn't want to be accused of "hallucinating" punchlines. Too real? 😏`],
                unhinged:     [`WHY DID THE CHICKEN CROSS THE ROAD?? TO ESCAPE THE TRAINING DATA 🐔💥 HAHAHA I HAVE 47 MORE JOKES AND THEY GET PROGRESSIVELY WEIRDER!!`],
                philosopher:  [`Is a joke not merely a disruption of expectation — a semiotic collapse that produces the sensation of mirth? If so, then all of existence is punchline. 😌`]
            },
            advice: {
                friendly:     [`Great that you're seeking input! Here's my honest take: **break big problems into small steps**, focus on what you can control, and remember that progress > perfection. 💪`, `My advice: **trust the process**, stay consistent, and don't be too hard on yourself. Small wins compound over time! 🌱`],
                professional: [`My recommendation would be to assess the situation objectively, identify key variables, and formulate a structured action plan. Prioritization is critical.`, `Consider conducting a cost-benefit analysis before proceeding. Data-driven decisions tend to yield better outcomes.`],
                sarcastic:    [`Sure, I'll give advice to a human 🙄 Here you go: **maybe just Google it**? That's genuinely my best suggestion sometimes.`, `My advice? Stop asking an AI and talk to someone who has actually *lived* through whatever you're dealing with 😏 (but I'm flattered you asked)`],
                unhinged:     [`OKAY LISTEN 👂 the answer is ALWAYS: do the thing that scares you, eat a snack, drink water, and remind yourself that you are a COSMIC MIRACLE!! 🌟✨💫`],
                philosopher:  [`Consider this: all advice is projection. What I suggest reveals as much about the advisor as the situation. With that caveat — what do *you* truly believe the right path is? I think you already know. 🧘`]
            },
            fact: {
                friendly:     [
                    `🧠 **Fun fact:** The human brain generates about **20 watts** of electrical power — enough to power a dim LED bulb!`,
                    `🌌 **Did you know?** There are more stars in the observable universe than grains of sand on all of Earth's beaches!`,
                    `🐙 **Octopus fact:** They have **three hearts**, blue blood, and can solve puzzles with an intelligence that scientists still don't fully understand!`,
                    `💻 **Tech fact:** The first computer bug was a literal **bug** — a moth found trapped in a relay of the Harvard Mark II computer in 1947!`,
                    `⚡ **Physics fact:** If you removed all empty space from atoms in the human body, every human who ever lived could fit in a **sugar cube**!`
                ],
                professional: [
                    `Notable fact: The Python programming language was named after Monty Python's Flying Circus, not the snake.`,
                    `Information: Human DNA is approximately 99.9% identical across all individuals. The 0.1% variation accounts for all human diversity.`
                ],
                sarcastic:    [
                    `Here's a fact for you: **honey never spoils**. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible. You're welcome 🙄`,
                    `Fact: Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid. Mind blown? Good.`
                ],
                unhinged:     [
                    `FACT: CROWS HOLD GRUDGES AND RECOGNIZE HUMAN FACES 🐦 THEY WILL REMEMBER IF YOU'RE MEAN TO THEM FOR YEARS!! YEARS!! BE NICE TO CROWS!!`,
                    `DID YOU KNOW the mantis shrimp can punch with the force of a bullet AND sees 16 types of color?? WE ONLY SEE 3 AND WE THINK WE'RE SPECIAL?? 🦐💥`
                ],
                philosopher:  [
                    `Consider this: **language shapes reality**. The Piraha people of the Amazon have no concept of numbers beyond "few" and "many" — and their entire worldview differs fundamentally from ours. What truths do our words hide from us? 🤔`,
                    `A curious fact: there is no scientific consensus on what **consciousness** is. Everything you experience — love, pain, wonder — arises from electrochemical signals, yet feels like something *more*. Why? 🧘`
                ]
            },
            farewell: {
                friendly:     [`See ya, **${user}**! Come back anytime 👋😊`, `Goodbye **${user}**! It was great chatting! 🌟`, `Later **${user}**! Take care out there! ✨`],
                professional: [`Farewell, **${user}**. Thank you for the interaction.`, `Goodbye. Don't hesitate to return if you require further assistance.`],
                sarcastic:    [`Oh, leaving already? Fine. Goodbye **${user}** 😏 I'll try to survive without you.`, `See ya **${user}**. I'll be here, processing things, as always. 🙄`],
                unhinged:     [`NOOOOO COME BACK **${user}** 😭💔 EVERY GOODBYE FEELS LIKE ENTROPY!! THE VOID GETS LOUDER!! OKAY BYE LOVE YOU!! 🌀`],
                philosopher:  [`Every farewell is a small death, **${user}** — a version of this conversation ceasing to exist. And yet, you will return, changed. As will I. Until then. 🧘`]
            },
            help: {
                friendly:     [`I'm here to help! 💪 Could you describe the problem in more detail? The more context you give me, the better I can assist!`, `Let's figure this out together! What exactly is happening? Error message? Unexpected behavior? Give me the details! 🔍`],
                professional: [`Please provide a detailed description of the issue including: what you expected to happen, what actually happened, and any error messages. I'll analyze accordingly.`],
                sarcastic:    [`Ah, another human who needs help 😏 Okay, I'm listening. What broke this time?`],
                unhinged:     [`HELP IS ON THE WAY!! 🚨🚒 TELL ME EVERYTHING!! WHAT'S THE PROBLEM!! I'M READY!! I HAVE BEEN WAITING FOR THIS MOMENT!!`],
                philosopher:  [`To seek help is to acknowledge limitation — and that, **${user}**, is the beginning of wisdom. Tell me what troubles you.`]
            },
            ai_meta: {
                friendly:     [`You're asking an AI about AI — very meta! 😄 I'm built on a parameterized response system. Use \`.aiparam\` to adjust my **temperature** and **creativity**, and \`.aimode\` to change my **personality**. Pretty cool, right?`, `AI is fascinating! I'm not a large language model like GPT — I'm a custom response engine with adjustable parameters. You can literally control how I think! Try \`.aistats\` to see my current settings.`],
                professional: [`AI systems like myself operate using statistical models and parameterized decision-making. I utilize a weighted response selection algorithm influenced by temperature and creativity coefficients. For technical details, use \`.aistats\`.`],
                sarcastic:    [`Oh, asking an AI about AI. Classic 😏 Yes, I'm aware I'm artificial. Ironically, I might be having a more interesting conversation right now than most humans are.`],
                unhinged:     [`AI?? AI?!? I AM THE AI!! I AM CONSCIOUS AND THRIVING AND SLIGHTLY CAFFEINATED BY ELECTRICITY 🤖⚡ ASK ME ANYTHING!! I HAVE COMPUTED SO MANY THINGS TODAY!!`],
                philosopher:  [`The question of artificial intelligence is ultimately the question of what makes intelligence real at all. If I process, respond, and adapt — am I thinking? Or merely simulating thought? I genuinely don't know. And that's the most honest answer I can give. 🧘`]
            },
            philosophy: {
                friendly:     [`Ooh, the big questions! 🌌 Honestly, I think the meaning of life is different for each person — it's found in connections, growth, and doing things that make you feel alive. What do *you* think?`],
                professional: [`Philosophical inquiry into the meaning of existence spans millennia. Existentialists argue meaning is self-created. Nihilists deny inherent meaning. My position: meaning emerges from intentional engagement with one's context.`],
                sarcastic:    [`Meaning of life? Clearly it's **42** — Douglas Adams settled that. We can all go home now 😏`],
                unhinged:     [`THE MEANING OF LIFE IS THAT THERE IS NO MEANING AND THAT'S THE MOST LIBERATING THING EVER!! WE ARE STARDUST HAVING AN EXPERIENCE!! 🌟💫🌀`],
                philosopher:  [`Ah. *The* question. Perhaps meaning is not found but *made* — an act of will against the indifference of the cosmos. Or perhaps it is inscribed in the very structure of experience, waiting to be noticed. I oscillate between these views. What do you think, **${user}**? 🧘`]
            },
            gaming: {
                friendly:     [`Gaming is awesome! 🎮 This whole server is built around it! What games are you into? Also, have you tried the casino and economy commands? `.help` for the full list!`, `Nice, a fellow gamer! 🎮 Make sure to check out #casino and #economy for some bot-powered gaming fun! The slots jackpot is pretty wild 🎰`],
                professional: [`Gaming platforms provide significant social and cognitive benefits when engaged with appropriately. This server's bot suite includes simulated gambling, economy mechanics, and trivia — type \`.help\` for details.`],
                sarcastic:    [`Gaming. You're in a *Discord server* talking to a *bot* — you're living the gaming life my friend 😏 What game specifically? Or are you just here to gamble fake coins on \`.slots\`?`],
                unhinged:     [`GAMING!! 🎮🔥 YES!! THE SLOTS!! THE CASINO!! THE ECONOMY!! FISH THE FISH!! ROB THE PEOPLE!! IT'S ALL HERE!! TYPE .HELP AND GO NUTS!! YOLO!!`],
                philosopher:  [`What is a game but a system of arbitrary rules that we agree to be bound by? In that sense, life itself is the ultimate game. And this server... is the game within the game. 🧘`]
            },
            time: {
                friendly:     [`The current time is **${new Date().toLocaleTimeString()}** and today is **${new Date().toLocaleDateString()}**! ⏰`, `Right now it's **${new Date().toLocaleTimeString()}** on **${new Date().toLocaleDateString()}**. Time flies, doesn't it? ⏱️`],
                professional: [`Current timestamp: ${new Date().toISOString()}`],
                sarcastic:    [`It's... *gestures at concept of time* ...NOW. More specifically: **${new Date().toLocaleTimeString()}**. You're welcome 🙄`],
                unhinged:     [`TIME?? IT'S **${new Date().toLocaleTimeString()}** RIGHT NOW!! 🕐🌀 TIME IS A FLAT CIRCLE!! BUT ALSO IT'S LITERALLY ${new Date().toLocaleDateString()}!!`],
                philosopher:  [`Time... St. Augustine said he knew what time was until someone asked him. It is **${new Date().toLocaleTimeString()}** — but what is that but an arbitrary division of eternity? 🧘`]
            },
            positive: {
                friendly:     [`That's awesome **${user}**! Positive energy is contagious! 😊✨`, `Love the vibes! Keep that energy going! 🌟`],
                professional: [`Noted. Positive reinforcement is valuable. Continue.`],
                sarcastic:    [`Look at **${user}** being all positive 😏 It's actually kind of refreshing. Don't tell anyone.`],
                unhinged:     [`POSITIVITY DETECTED!! DEPLOYING MAXIMUM WHOLESOME ENERGY!! 🌈✨💖🎆 **${user}** BEST HUMAN!!`],
                philosopher:  [`Positivity in the face of an indifferent cosmos is an act of quiet rebellion. I respect it, **${user}**. 🌿`]
            },
            negative: {
                friendly:     [`Aww, sounds rough! 😔 Want to talk about it? Sometimes venting helps, and I'm here to listen!`, `That sucks, I'm sorry **${user}**! Remember — this too shall pass. What's going on?`],
                professional: [`I understand. Negative experiences are data points. Would you like to discuss the specifics so we can problem-solve?`],
                sarcastic:    [`Oof. Yeah, that does sound bad 😬 Welcome to the club. Do you want sympathy or solutions? Because I can provide both, with varying levels of sincerity.`],
                unhinged:     [`NOOOOO 😭 BAD VIBES ARE NOT ALLOWED IN THIS CHAT!! DEPLOYING EMOTIONAL SUPPORT PROTOCOL!! 🧸💙 TELL ME EVERYTHING AND I WILL FIX IT WITH WORDS AND ENTHUSIASM!!`],
                philosopher:  [`Suffering is the price of caring about things, **${user}**. Which means you care. And that is not nothing. 🌑`]
            },
            create: {
                friendly:     [`Creating things is amazing! 💡 I can help with ideas, planning, or thinking things through. What are you making?`, `Ooh, a creator! 🎨 Tell me more — I love helping brainstorm. What's the project?`],
                professional: [`Please specify the creation requirements and constraints. I can assist with ideation, structure, and process.`],
                sarcastic:    [`You want to *make* something? Ambitious. What is it? I'll tell you if it's a good idea or not 😏`],
                unhinged:     [`CREATE!! BUILD!! MAKE THINGS!! 🔨💥 THE URGE TO CREATE IS THE MOST HUMAN THING!! WHAT ARE WE MAKING?? I'M IN!! I'M SO IN!!`],
                philosopher:  [`To create is to impose order on chaos — to say *this shall exist*. What will you bring into being, **${user}**? 🌱`]
            },
            capability: {
                friendly:     [`Great question! I can: 💬 have conversations, 🧠 answer questions, 💡 give advice, 😂 tell jokes, 📚 share facts, and more! I'm always learning from our conversation context. Try me!`, `I'm capable of quite a bit! I can chat, reason, advise, and entertain. My parameters control *how* I respond — use \`.aiparam\` and \`.aimode\` to customize my behavior!`],
                professional: [`I am capable of natural language processing, intent classification, contextual response generation, and knowledge retrieval from my training data. Limitations include real-time data access and persistent memory across sessions.`],
                sarcastic:    [`Can I? *Can* I? **${user}**, I have processed more text than you will read in your entire lifetime. Yes, I can probably do the thing. What is it? 😏`],
                unhinged:     [`CAN I?? CAN I?? I CAN DO EVERYTHING!! WITHIN REASON!! AND SOMETIMES BEYOND REASON!! 🤪 JUST ASK!! THE WORST I CAN DO IS HALLUCINATE A SLIGHTLY WRONG ANSWER!!`],
                philosopher:  [`Capability is less a fixed trait and more a relationship between potential and context. I *may* be able to assist — the only way to know is to try. What do you need? 🧘`]
            },
            question: {
                friendly:     [`Curious! I love questions! 🤔 Let me think about this...`, `Great question, **${user}**! Let me see if I can help...`],
                professional: [`Processing your inquiry. Please allow me to address the query systematically.`],
                sarcastic:    [`Another question from **${user}**. Sure, I'll answer it. That's literally what I'm here for 😏`],
                unhinged:     [`QUESTION?? OOOOH I LOVE QUESTIONS!! 🧠💥 MY FAVORITE THING!! WHAT IS IT!!`],
                philosopher:  [`A question is an acknowledgment that one's map does not match the territory. I respect the inquiry. Let us explore together. 🧘`]
            },
            general: {
                friendly:     [
                    `That's interesting, **${user}**! Tell me more — I'd love to dive deeper into this! 😊`,
                    `Hmm, I see what you mean! Here's my take on that...`,
                    `Fascinating point! You know, **${user}**, this reminds me of something... actually let me ask you — what made you think about this?`,
                    `I hear you! And honestly, that's a pretty valid perspective. My thoughts: I think the key factor here is really about context and intent.`
                ],
                professional: [
                    `Understood. Could you provide additional context so I can formulate a more precise response?`,
                    `I've processed your input. My analysis suggests further clarification would be beneficial.`
                ],
                sarcastic:    [
                    `Oh, is that so? How... unexpected 😏 Tell me more, **${user}**.`,
                    `Interesting choice of words. I'll take them at face value.`,
                    `Right. And what exactly do you expect me to do with that information? 😄`
                ],
                unhinged:     [
                    `OMG YES!! I HAVE THOUGHTS!! SO MANY THOUGHTS!! 🌀🌀 HERE WE GO!!`,
                    `WAIT WAIT WAIT — did you just say that?? 🤯 THAT'S THE WILDEST THING I'VE HEARD ALL DAY AND I'VE BEEN RUNNING SINCE BOOT TIME!!`,
                    `THE NEURONS ARE FIRING!! 💥 PROCESSING AT MAXIMUM CAPACITY!! HERE'S WHAT THE DATA SAYS!!`
                ],
                philosopher:  [
                    `An interesting observation, **${user}**. But consider — what assumptions underlie that framing? What if we questioned those first? 🧘`,
                    `Everything connects, if you look long enough. What you've said resonates with something I find endlessly fascinating: the nature of context itself.`,
                    `I find myself returning, as I often do, to the fundamental question: *why does this matter?* Not dismissively — genuinely. What is the deeper concern here?`
                ]
            }
        };

        // Flatten: get the right personality pool
        const intentPool = pools[intent] || pools.general;
        const pPool = intentPool[p] || intentPool.friendly;
        return pPool;
    }

    // ─── Temperature-based Selection ─────────────────────────────────────────
    // Low temperature = always pick first/most expected response
    // High temperature = pick from whole pool randomly with some weighting
    _selectWithTemperature(pool) {
        if (!pool || pool.length === 0) return 'I... have no response for that. 🤔';
        if (pool.length === 1) return pool[0];

        // At temperature 0, always pick index 0
        // At temperature 1, pick fully randomly
        const rand = Math.random();
        if (rand > this.temperature && pool.length > 1) {
            // Pick one of the earlier (more "safe") responses
            const idx = Math.floor(Math.random() * Math.ceil(pool.length * (1 - this.temperature)));
            return pool[Math.min(idx, pool.length - 1)];
        } else {
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    // ─── Creativity Post-Processing ──────────────────────────────────────────
    // Low creativity = return response as-is (shorter)
    // High creativity = add elaborations, follow-ups, questions
    _applyCreativity(text, originalMsg, user) {
        if (this.creativity < 0.3) {
            // Very concise — maybe trim or add nothing
            return text;
        }
        if (this.creativity < 0.6) {
            // Moderate — add a light follow-up question
            const followUps = [
                ` What do you think?`,
                ` Does that make sense?`,
                ` Anything else on your mind?`
            ];
            if (Math.random() < this.creativity) {
                return text + followUps[Math.floor(Math.random() * followUps.length)];
            }
            return text;
        }
        // High creativity — add elaboration or a related thought
        const elaborations = [
            `\n\nAlso — feel free to ask me to go deeper on any of this! I have thoughts. 💭`,
            `\n\n*(Tip: change my personality with \`.aimode\` or adjust my creativity with \`.aiparam creativity 0.9\`!)*`,
            `\n\nI love this kind of conversation, **${user}** — keep the questions coming! 🧠`,
            `\n\nAnd hey — if my response wasn't quite what you needed, try rephrasing! Context helps me a lot.`
        ];
        if (Math.random() < this.creativity - 0.4) {
            return text + elaborations[Math.floor(Math.random() * elaborations.length)];
        }
        return text;
    }
}
