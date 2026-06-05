class CasinoBot {
    constructor(username) {
        this.username = username;
        this.db = this.loadDatabase();
        this.channels = this.loadChannels();
        this.activeChannel = 'general';
        this.initUser();
    }

    loadDatabase() {
        const data = localStorage.getItem('botData_allUsers');
        if (data) {
            try { return JSON.parse(data); } catch(e) { return {}; }
        }
        return {};
    }

    loadChannels() {
        const data = localStorage.getItem('botData_channels');
        if (data) {
            try { return JSON.parse(data); } catch(e) { return this.defaultChannels(); }
        }
        return this.defaultChannels();
    }

    defaultChannels() {
        return [
            { id: 'general',    name: 'general',    topic: 'Welcome to the server! Use .help for commands.' },
            { id: 'casino',     name: 'casino',     topic: 'Place your bets! 🎰 Use .slots, .bet, .blackjack' },
            { id: 'economy',    name: 'economy',    topic: 'Work, rob, fish, and earn. 💰' },
            { id: 'trivia',     name: 'trivia',     topic: 'Test your knowledge! Use .trivia' },
            { id: 'leaderboard',name: 'leaderboard',topic: 'Top players. Use .lb to see rankings.' }
        ];
    }

    saveDatabase() {
        localStorage.setItem('botData_allUsers', JSON.stringify(this.db));
    }

    saveChannels() {
        localStorage.setItem('botData_channels', JSON.stringify(this.channels));
    }

    initUser() {
        if (!this.db[this.username]) {
            this.db[this.username] = {
                points: 100,
                dollars: 0,
                role: 'Member',
                lastDaily: 0,
                lastWork: 0,
                lastRob: 0,
                lastFish: 0,
                lastHunt: 0,
                inventory: [],
                xp: 0,
                level: 1,
                wins: 0,
                losses: 0
            };
            this.isNew = true;
            this.saveDatabase();
        } else {
            // Patch missing fields for existing users
            const u = this.db[this.username];
            if (u.lastWork === undefined) u.lastWork = 0;
            if (u.lastRob === undefined) u.lastRob = 0;
            if (u.lastFish === undefined) u.lastFish = 0;
            if (u.lastHunt === undefined) u.lastHunt = 0;
            if (u.inventory === undefined) u.inventory = [];
            if (u.xp === undefined) u.xp = 0;
            if (u.level === undefined) u.level = 1;
            if (u.wins === undefined) u.wins = 0;
            if (u.losses === undefined) u.losses = 0;
            this.isNew = false;
            this.saveDatabase();
        }
    }

    get points() { return this.db[this.username].points; }
    set points(val) { this.db[this.username].points = Math.max(0, val); }

    get dollars() { return this.db[this.username].dollars; }
    set dollars(val) { this.db[this.username].dollars = Math.max(0, val); }

    get role() { return this.db[this.username].role; }
    set role(val) { this.db[this.username].role = val; }

    get xp() { return this.db[this.username].xp; }
    set xp(val) { this.db[this.username].xp = val; }

    get level() { return this.db[this.username].level; }
    set level(val) { this.db[this.username].level = val; }

    get wins() { return this.db[this.username].wins; }
    set wins(val) { this.db[this.username].wins = val; }

    get losses() { return this.db[this.username].losses; }
    set losses(val) { this.db[this.username].losses = val; }

    get inventory() { return this.db[this.username].inventory; }

    get isAdmin() { return this.role === 'Admin' || this.role === 'Owner'; }

    addXP(amount) {
        this.xp += amount;
        const xpNeeded = this.level * 200;
        if (this.xp >= xpNeeded) {
            this.xp -= xpNeeded;
            this.level += 1;
            this.saveDatabase();
            return true; // leveled up
        }
        this.saveDatabase();
        return false;
    }

    formatCooldown(ms) {
        const s = Math.ceil(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.ceil(s / 60);
        if (m < 60) return `${m}m`;
        return `${Math.ceil(m / 60)}h`;
    }

    getWelcomeMessage() {
        if (this.isNew) {
            return `Welcome to **Gaming Central**, **${this.username}**! 🎉 I'm CasinoBot. You've been given **100 points** to start. Type \`.help\` to see all commands!`;
        } else {
            return `Welcome back, **${this.username}**! ⚡ You have **${this.points} pts** | **$${this.dollars}** | Level **${this.level}**. Good luck today!`;
        }
    }

    processCommand(input) {
        const args = input.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        switch (command) {
            case 'help': return this.cmdHelp();
            case 'bal':
            case 'balance': return this.cmdBalance();
            case 'profile':
            case 'p': return this.cmdProfile(args);
            case 'convert': return this.cmdConvert(args);
            case 'bet': return this.cmdBet(args);
            case 'slots': return this.cmdSlots(args);
            case 'blackjack':
            case 'bj': return this.cmdBlackjack(args);
            case 'daily': return this.cmdDaily();
            case 'leaderboard':
            case 'lb': return this.cmdLeaderboard();
            case 'buy': return this.cmdBuy(args);
            case 'shop': return this.cmdShop();
            case 'inventory':
            case 'inv': return this.cmdInventory();
            case 'work': return this.cmdWork();
            case 'fish': return this.cmdFish();
            case 'hunt': return this.cmdHunt();
            case 'rob': return this.cmdRob(args);
            case 'rps': return this.cmdRPS(args);
            case '8ball': return this.cmd8Ball(args);
            case 'flip': return this.cmdFlip(args);
            case 'trivia': return this.cmdTrivia();
            case 'pay': return this.cmdPay(args);
            case 'iamadmin':
                this.role = 'Owner';
                this.saveDatabase();
                return { type: 'system', action: 'update_roles', content: 'You are now an Owner. Shh, keep it a secret.' };
            case 'give':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission to use this command.' };
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
                return { type: 'system', action: 'clear_chat', content: '🧹 Chat cleared.' };
            case 'resetdb':
                if (!this.isAdmin) return { type: 'text', content: '❌ You do not have permission.' };
                return this.cmdResetDB(args);
            default:
                return { type: 'text', content: `❓ Unknown command \`.${command}\`. Type \`.help\` for a list of commands.` };
        }
    }

    cmdHelp() {
        return {
            type: 'embed',
            title: '🤖 CasinoBot — All Commands',
            fields: [
                { name: '💰 Economy', value: '`.bal` · `.daily` · `.work` · `.fish` · `.hunt` · `.rob <user>` · `.pay <user> <amt>` · `.convert <amt>`' },
                { name: '🎰 Casino Games', value: '`.bet coinflip <amt> [h/t]` · `.bet dice <amt>` · `.slots <amt>` · `.blackjack <amt>` · `.flip <amt>`' },
                { name: '🎮 Mini Games', value: '`.rps <rock|paper|scissors>` · `.8ball <question>` · `.trivia`' },
                { name: '🏪 Shop & Inventory', value: '`.shop` · `.buy <item>` · `.inventory`' },
                { name: '📊 Stats', value: '`.profile [user]` · `.leaderboard` · `.lb`' },
                { name: '🔒 Admin Only', value: '`.give <user> <amt>` · `.take <user> <amt>` · `.setrole <user> <role>` · `.createchannel <name>` · `.clear`' }
            ],
            color: 'default'
        };
    }

    cmdBalance() {
        const xpNeeded = this.level * 200;
        const xpBar = Math.floor((this.xp / xpNeeded) * 10);
        const bar = '█'.repeat(xpBar) + '░'.repeat(10 - xpBar);
        return {
            type: 'embed',
            title: `💰 Balance — ${this.username}`,
            fields: [
                { name: '🪙 Points', value: `**${this.points.toLocaleString()} pts**` },
                { name: '💵 Dollars', value: `**$${this.dollars.toLocaleString()}**` },
                { name: '🎖️ Role', value: this.role },
                { name: `⭐ Level ${this.level}`, value: `\`[${bar}]\` ${this.xp}/${xpNeeded} XP` }
            ],
            color: 'default'
        };
    }

    cmdProfile(args) {
        const target = args.length > 0 ? args[0] : this.username;
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };

        const u = this.db[target];
        const total = (u.wins || 0) + (u.losses || 0);
        const wr = total > 0 ? Math.round(((u.wins || 0) / total) * 100) : 0;
        const xpNeeded = (u.level || 1) * 200;
        const xpBar = Math.floor(((u.xp || 0) / xpNeeded) * 10);
        const bar = '█'.repeat(xpBar) + '░'.repeat(10 - xpBar);

        return {
            type: 'embed',
            title: `👤 Profile — ${target}`,
            fields: [
                { name: '🎖️ Role', value: u.role },
                { name: `⭐ Level ${u.level || 1}`, value: `\`[${bar}]\` ${u.xp || 0}/${xpNeeded} XP` },
                { name: '🪙 Points', value: `${(u.points || 0).toLocaleString()} pts` },
                { name: '💵 Dollars', value: `$${(u.dollars || 0).toLocaleString()}` },
                { name: '🏆 Win Rate', value: `${wr}% (${u.wins || 0}W / ${u.losses || 0}L)` },
                { name: '🎒 Inventory', value: (u.inventory || []).length > 0 ? (u.inventory || []).join(', ') : 'Empty' }
            ],
            color: 'default'
        };
    }

    cmdDaily() {
        const now = Date.now();
        const last = this.db[this.username].lastDaily || 0;
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - last < oneDay) {
            const left = oneDay - (now - last);
            return { type: 'text', content: `⏰ You already claimed your daily! Come back in **${this.formatCooldown(left)}**.` };
        }

        const streak = this.db[this.username].dailyStreak || 0;
        const newStreak = (now - last < oneDay * 2) ? streak + 1 : 1;
        const bonus = Math.min(newStreak * 10, 100);
        const reward = 100 + bonus;

        this.points += reward;
        this.db[this.username].lastDaily = now;
        this.db[this.username].dailyStreak = newStreak;
        const leveled = this.addXP(50);
        this.saveDatabase();

        return {
            type: 'embed',
            title: '🎁 Daily Reward Claimed!',
            fields: [
                { name: '🎁 Received', value: `**+${reward} pts**` },
                { name: '🔥 Streak', value: `**${newStreak} day${newStreak > 1 ? 's' : ''}** (+${bonus} bonus)` },
                { name: '💰 New Balance', value: `${this.points} pts` },
                leveled ? { name: '⭐ Level Up!', value: `You reached Level **${this.level}**!` } : null
            ].filter(Boolean),
            color: 'win'
        };
    }

    cmdConvert(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.convert <amount>`' };
        let amount = args[0].toLowerCase() === 'all' ? this.points : parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        const rate = 10;
        const dollars = Math.floor(amount / rate);
        if (dollars === 0) return { type: 'text', content: `❌ You need at least **${rate} pts** to convert into $1.` };

        const spent = dollars * rate;
        this.points -= spent;
        this.dollars += dollars;
        this.saveDatabase();

        return {
            type: 'embed',
            title: '💱 Conversion Successful',
            fields: [
                { name: '📤 Spent', value: `${spent} pts` },
                { name: '📥 Received', value: `$${dollars}` },
                { name: '💰 New Balance', value: `${this.points} pts | $${this.dollars}` }
            ],
            color: 'win'
        };
    }

    cmdShop() {
        return {
            type: 'embed',
            title: '🏪 Item Shop',
            fields: [
                { name: '⭐ VIP Role — $50', value: 'Get a golden name and exclusive perks.' },
                { name: '🎟️ Lucky Ticket — 200 pts', value: 'Doubles your next slot win.' },
                { name: '🛡️ Robber Shield — 100 pts', value: 'Protects you from being robbed once.' },
                { name: '🎣 Pro Rod — 150 pts', value: 'Increases fishing rewards by 50%.' },
                { name: '🏹 Hunter Bow — 150 pts', value: 'Increases hunting rewards by 50%.' },
                { name: '💊 XP Boost — 300 pts', value: 'Doubles XP gain for 24 hours.' }
            ],
            color: 'default'
        };
    }

    cmdBuy(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.buy <item>` — See `.shop` for items.' };
        const item = args[0].toLowerCase();

        const items = {
            'vip': { cost: 50, currency: 'dollars', name: 'VIP Role' },
            'ticket': { cost: 200, currency: 'points', name: '🎟️ Lucky Ticket' },
            'shield': { cost: 100, currency: 'points', name: '🛡️ Robber Shield' },
            'rod': { cost: 150, currency: 'points', name: '🎣 Pro Rod' },
            'bow': { cost: 150, currency: 'points', name: '🏹 Hunter Bow' },
            'boost': { cost: 300, currency: 'points', name: '💊 XP Boost' }
        };

        const found = items[item];
        if (!found) return { type: 'text', content: `❌ Unknown item. Use \`.shop\` to see available items.` };

        if (item === 'vip') {
            if (this.role === 'VIP' || this.role === 'Admin' || this.role === 'Owner') {
                return { type: 'text', content: '✅ You already have VIP or a higher role.' };
            }
            if (this.dollars < 50) return { type: 'text', content: `❌ VIP costs **$50**. You only have **$${this.dollars}**. Use \`.convert\` to get dollars.` };
            this.dollars -= 50;
            this.role = 'VIP';
            this.saveDatabase();
            return { type: 'system', action: 'update_roles', content: '🎉 You successfully bought the **VIP** role! Your name is now golden.' };
        }

        const bal = found.currency === 'dollars' ? this.dollars : this.points;
        if (bal < found.cost) return { type: 'text', content: `❌ **${found.name}** costs **${found.cost} ${found.currency}**. You have **${bal}**.` };

        // Check if already have item
        if (this.inventory.includes(found.name)) {
            return { type: 'text', content: `❌ You already own **${found.name}**!` };
        }

        if (found.currency === 'dollars') this.dollars -= found.cost;
        else this.points -= found.cost;
        this.inventory.push(found.name);
        this.saveDatabase();

        return {
            type: 'embed',
            title: '🛒 Purchase Successful!',
            fields: [
                { name: 'Item', value: found.name },
                { name: 'Cost', value: `${found.cost} ${found.currency}` }
            ],
            color: 'win'
        };
    }

    cmdInventory() {
        const inv = this.inventory;
        return {
            type: 'embed',
            title: `🎒 Inventory — ${this.username}`,
            fields: [
                { name: 'Items', value: inv.length > 0 ? inv.join('\n') : 'Your inventory is empty. Use `.shop` to buy items!' }
            ],
            color: 'default'
        };
    }

    cmdLeaderboard() {
        const users = Object.keys(this.db).map(name => ({
            name,
            points: this.db[name].points || 0,
            dollars: this.db[name].dollars || 0,
            level: this.db[name].level || 1
        })).sort((a, b) => b.points - a.points).slice(0, 10);

        const medals = ['🥇', '🥈', '🥉'];
        const desc = users.map((u, i) =>
            `${medals[i] || `**${i+1}.**`} **${u.name}** — ${u.points.toLocaleString()} pts | $${u.dollars} | Lv.${u.level}`
        ).join('\n');

        return {
            type: 'embed',
            title: '🏆 Global Leaderboard',
            fields: [{ name: 'Top Players', value: desc || 'No players yet.' }],
            color: 'default'
        };
    }

    cmdBet(args) {
        if (args.length < 2) return { type: 'text', content: 'Usage: `.bet <game> <amount> [options]`' };

        const game = args[0].toLowerCase();
        let amount = args[1].toLowerCase() === 'all' ? this.points : parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid bet amount.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        if (game === 'coinflip' || game === 'cf') return this.playCoinflip(amount, args[2]);
        if (game === 'dice') return this.playDice(amount);
        return { type: 'text', content: `❌ Unknown game \`${game}\`. Available: \`coinflip\`, \`dice\`.` };
    }

    cmdSlots(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.slots <amount>`' };
        let amount = args[0].toLowerCase() === 'all' ? this.points : parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (amount < 1) return { type: 'text', content: '❌ Minimum bet is 1 pt.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        const hasTicket = this.inventory.includes('🎟️ Lucky Ticket');

        const symbols = ['🍒', '🍋', '🍇', '🍉', '⭐', '💎', '7️⃣'];
        const weights = [30, 25, 20, 15, 5, 3, 2]; // weighted probability
        const spin = Array.from({ length: 3 }, () => this.weightedRandom(symbols, weights));

        const allSame = spin[0] === spin[1] && spin[1] === spin[2];
        const twoSame = spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2];

        if (allSame) {
            const multipliers = { '🍒': 3, '🍋': 3, '🍇': 4, '🍉': 4, '⭐': 8, '💎': 20, '7️⃣': 50 };
            let mult = multipliers[spin[0]] || 3;
            if (hasTicket) {
                mult *= 2;
                // Remove ticket from inventory
                const idx = this.inventory.indexOf('🎟️ Lucky Ticket');
                if (idx > -1) this.inventory.splice(idx, 1);
            }
            const winnings = amount * mult;
            this.points += winnings;
            this.wins += 1;
            const leveled = this.addXP(30);
            this.saveDatabase();
            return {
                type: 'embed',
                title: `🎰 JACKPOT! ${hasTicket ? '(Lucky Ticket used!)' : ''}`,
                fields: [
                    { name: 'Reels', value: `\`[ ${spin.join(' | ')} ]\`` },
                    { name: '🏆 Profit', value: `**+${winnings} pts** (${mult}x)` },
                    { name: '💰 Balance', value: `${this.points} pts` },
                    leveled ? { name: '⭐ Level Up!', value: `You reached Level **${this.level}**!` } : null
                ].filter(Boolean),
                color: 'win'
            };
        } else if (twoSame) {
            const refund = Math.floor(amount * 0.5);
            this.points -= (amount - refund);
            this.losses += 1;
            this.addXP(5);
            this.saveDatabase();
            return {
                type: 'embed',
                title: '🎰 Almost! Two of a kind',
                fields: [
                    { name: 'Reels', value: `\`[ ${spin.join(' | ')} ]\`` },
                    { name: '💸 Loss', value: `-${amount - refund} pts (50% refund)` },
                    { name: '💰 Balance', value: `${this.points} pts` }
                ],
                color: 'lose'
            };
        } else {
            this.points -= amount;
            this.losses += 1;
            this.addXP(5);
            this.saveDatabase();
            return {
                type: 'embed',
                title: '🎰 No match — LOSS',
                fields: [
                    { name: 'Reels', value: `\`[ ${spin.join(' | ')} ]\`` },
                    { name: '💸 Loss', value: `-${amount} pts` },
                    { name: '💰 Balance', value: `${this.points} pts` }
                ],
                color: 'lose'
            };
        }
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

    cmdBlackjack(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.blackjack <amount>`' };
        let amount = args[0].toLowerCase() === 'all' ? this.points : parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        const deck = [2,3,4,5,6,7,8,9,10,10,10,10,11];
        const draw = () => deck[Math.floor(Math.random() * deck.length)];
        const calcHand = (hand) => {
            let total = hand.reduce((a,b) => a+b, 0);
            let aces = hand.filter(c => c === 11).length;
            while (total > 21 && aces > 0) { total -= 10; aces--; }
            return total;
        };

        const playerHand = [draw(), draw()];
        const dealerHand = [draw(), draw()];
        // Simple bot: dealer draws until 17+
        while (calcHand(dealerHand) < 17) dealerHand.push(draw());

        const pTotal = calcHand(playerHand);
        const dTotal = calcHand(dealerHand);

        const pCards = playerHand.join(' + ');
        const dCards = dealerHand.join(' + ');

        let result, color;
        if (pTotal > 21) {
            this.points -= amount; this.losses += 1; result = 'BUST! You went over 21.'; color = 'lose';
        } else if (dTotal > 21) {
            this.points += amount; this.wins += 1; result = "Dealer busted! YOU WIN!"; color = 'win';
        } else if (pTotal > dTotal) {
            this.points += amount; this.wins += 1; result = 'YOU WIN!'; color = 'win';
        } else if (pTotal === dTotal) {
            result = "Push! It's a tie — bet returned."; color = 'default';
        } else {
            this.points -= amount; this.losses += 1; result = 'Dealer wins. You lose.'; color = 'lose';
        }

        this.addXP(10);
        this.saveDatabase();
        return {
            type: 'embed',
            title: `🃏 Blackjack — ${result}`,
            fields: [
                { name: '🧑 Your Hand', value: `\`${pCards}\` = **${pTotal}**` },
                { name: '🤖 Dealer Hand', value: `\`${dCards}\` = **${dTotal}**` },
                { name: color === 'win' ? '🏆 Profit' : color === 'lose' ? '💸 Loss' : '↩️ Result', value: color === 'win' ? `+${amount} pts` : color === 'lose' ? `-${amount} pts` : 'No change' },
                { name: '💰 Balance', value: `${this.points} pts` }
            ],
            color
        };
    }

    cmdFlip(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.flip <amount>` — Simple 50/50 coinflip!' };
        let amount = args[0].toLowerCase() === 'all' ? this.points : parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        const won = Math.random() < 0.5;
        const coin = won ? '🟡 Heads' : '⚫ Tails';
        if (won) {
            this.points += amount; this.wins += 1;
        } else {
            this.points -= amount; this.losses += 1;
        }
        this.addXP(5);
        this.saveDatabase();
        return {
            type: 'embed',
            title: `🪙 Coin Flip — ${won ? 'WIN!' : 'LOSS'}`,
            fields: [
                { name: 'Result', value: coin },
                { name: won ? '🏆 Profit' : '💸 Loss', value: `${won ? '+' : '-'}${amount} pts` },
                { name: '💰 Balance', value: `${this.points} pts` }
            ],
            color: won ? 'win' : 'lose'
        };
    }

    playCoinflip(amount, choice) {
        choice = choice ? choice.toLowerCase() : 'heads';
        if (!['heads','tails','h','t'].includes(choice)) {
            return { type: 'text', content: '❌ Choice must be `heads` (h) or `tails` (t).' };
        }
        if (choice === 'h') choice = 'heads';
        if (choice === 't') choice = 'tails';

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === choice;

        if (won) {
            this.points += amount; this.wins += 1;
        } else {
            this.points -= amount; this.losses += 1;
        }
        this.addXP(5);
        this.saveDatabase();
        return {
            type: 'embed',
            title: `🪙 Coin Flip — ${won ? 'WIN!' : 'LOSS'}`,
            fields: [
                { name: 'Your Choice', value: choice },
                { name: 'Result', value: `The coin landed on **${result}**` },
                { name: won ? '🏆 Profit' : '💸 Loss', value: `${won ? '+' : '-'}${amount} pts` },
                { name: '💰 Balance', value: `${this.points} pts` }
            ],
            color: won ? 'win' : 'lose'
        };
    }

    playDice(amount) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const won = roll === 6;
        if (won) {
            const winnings = amount * 5;
            this.points += winnings; this.wins += 1;
            this.addXP(15);
            this.saveDatabase();
            return {
                type: 'embed',
                title: '🎲 Dice Roll — WIN!',
                fields: [
                    { name: 'Roll', value: `You rolled a **${roll}**! 🎉` },
                    { name: '🏆 Profit', value: `+${winnings} pts (5x)` },
                    { name: '💰 Balance', value: `${this.points} pts` }
                ],
                color: 'win'
            };
        } else {
            this.points -= amount; this.losses += 1;
            this.addXP(5);
            this.saveDatabase();
            return {
                type: 'embed',
                title: '🎲 Dice Roll — LOSS',
                fields: [
                    { name: 'Roll', value: `You rolled a **${roll}**. Need a 6 to win!` },
                    { name: '💸 Loss', value: `-${amount} pts` },
                    { name: '💰 Balance', value: `${this.points} pts` }
                ],
                color: 'lose'
            };
        }
    }

    cmdWork() {
        const now = Date.now();
        const cooldown = 5 * 60 * 1000; // 5 minutes
        const last = this.db[this.username].lastWork || 0;
        if (now - last < cooldown) {
            return { type: 'text', content: `⏰ You're tired! Rest for **${this.formatCooldown(cooldown - (now - last))}** before working again.`, botName: 'EconomyBot' };
        }

        const jobs = [
            { text: 'delivered pizzas', min: 20, max: 60 },
            { text: 'coded a website', min: 40, max: 90 },
            { text: 'drove for Uber', min: 15, max: 50 },
            { text: 'sold lemonade', min: 10, max: 30 },
            { text: 'streamed on Twitch', min: 5, max: 100 },
            { text: 'mined crypto', min: 1, max: 200 },
            { text: 'walked dogs', min: 20, max: 55 }
        ];
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

        this.points += earnings;
        this.db[this.username].lastWork = now;
        const leveled = this.addXP(20);
        this.saveDatabase();

        return {
            type: 'text',
            content: `💼 You ${job.text} and earned **+${earnings} pts**!${leveled ? ` ⭐ Level up! You're now Level **${this.level}**!` : ''}`,
            botName: 'EconomyBot'
        };
    }

    cmdFish() {
        const now = Date.now();
        const cooldown = 3 * 60 * 1000; // 3 minutes
        const last = this.db[this.username].lastFish || 0;
        if (now - last < cooldown) {
            return { type: 'text', content: `⏰ The fish aren't biting yet! Wait **${this.formatCooldown(cooldown - (now - last))}**.`, botName: 'EconomyBot' };
        }

        const hasRod = this.inventory.includes('🎣 Pro Rod');
        const catches = [
            { name: 'nothing 🪣', pts: 0, rare: false },
            { name: 'a Boot 👟', pts: 2, rare: false },
            { name: 'a Small Fish 🐟', pts: 10, rare: false },
            { name: 'a Salmon 🐠', pts: 20, rare: false },
            { name: 'a Tuna 🐡', pts: 35, rare: false },
            { name: 'a Swordfish ⚔️', pts: 60, rare: true },
            { name: 'a Legendary Kraken 🦑', pts: 200, rare: true }
        ];
        const weights = [10, 15, 30, 25, 12, 6, 2];
        const caught = this.weightedRandom(catches, weights);
        let pts = caught.pts;
        if (hasRod) pts = Math.floor(pts * 1.5);

        this.db[this.username].lastFish = now;
        if (pts > 0) {
            this.points += pts;
            this.addXP(10);
        }
        this.saveDatabase();

        return {
            type: 'text',
            content: pts > 0
                ? `🎣 You cast your line and caught **${caught.name}**! ${hasRod ? '(Pro Rod bonus!) ' : ''}**+${pts} pts**`
                : `🎣 You fished for a while and caught... **${caught.name}**. Better luck next time!`,
            botName: 'EconomyBot'
        };
    }

    cmdHunt() {
        const now = Date.now();
        const cooldown = 4 * 60 * 1000; // 4 minutes
        const last = this.db[this.username].lastHunt || 0;
        if (now - last < cooldown) {
            return { type: 'text', content: `⏰ No animals in sight! Try again in **${this.formatCooldown(cooldown - (now - last))}**.`, botName: 'EconomyBot' };
        }

        const hasBow = this.inventory.includes('🏹 Hunter Bow');
        const prey = [
            { name: 'nothing 🌿', pts: 0 },
            { name: 'a Rabbit 🐇', pts: 15 },
            { name: 'a Deer 🦌', pts: 40 },
            { name: 'a Wolf 🐺', pts: 65 },
            { name: 'a Bear 🐻', pts: 90 },
            { name: 'a Dragon 🐉', pts: 250 }
        ];
        const weights = [15, 30, 25, 15, 10, 5];
        const hunted = this.weightedRandom(prey, weights);
        let pts = hunted.pts;
        if (hasBow) pts = Math.floor(pts * 1.5);

        this.db[this.username].lastHunt = now;
        if (pts > 0) {
            this.points += pts;
            this.addXP(10);
        }
        this.saveDatabase();

        return {
            type: 'text',
            content: pts > 0
                ? `🏹 You ventured into the forest and hunted **${hunted.name}**! ${hasBow ? '(Hunter Bow bonus!) ' : ''}**+${pts} pts**`
                : `🏹 You searched the forest but found **${hunted.name}**. The hunt continues...`,
            botName: 'EconomyBot'
        };
    }

    cmdRob(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.rob <user>`', botName: 'EconomyBot' };
        const target = args[0];

        const now = Date.now();
        const cooldown = 10 * 60 * 1000; // 10 minutes
        const last = this.db[this.username].lastRob || 0;
        if (now - last < cooldown) {
            return { type: 'text', content: `⏰ You're on the radar! Lay low for **${this.formatCooldown(cooldown - (now - last))}**.`, botName: 'EconomyBot' };
        }

        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.`, botName: 'EconomyBot' };
        if (target === this.username) return { type: 'text', content: "🤦 You can't rob yourself!", botName: 'EconomyBot' };
        if (this.db[target].points < 20) return { type: 'text', content: `💸 **${target}** is too broke. Have some mercy!`, botName: 'EconomyBot' };

        // Shield check
        const hasShield = (this.db[target].inventory || []).includes('🛡️ Robber Shield');

        this.db[this.username].lastRob = now;

        if (hasShield) {
            const idx = this.db[target].inventory.indexOf('🛡️ Robber Shield');
            this.db[target].inventory.splice(idx, 1);
            const fine = Math.floor(Math.random() * 20) + 10;
            this.points -= Math.min(fine, this.points);
            this.saveDatabase();
            return {
                type: 'text',
                content: `🛡️ **${target}** had a **Robber Shield**! You got repelled and fined **${fine} pts**!`,
                botName: 'EconomyBot'
            };
        }

        const success = Math.random() > 0.45;
        if (success) {
            const stolen = Math.floor(Math.random() * 30) + 10;
            const actual = Math.min(stolen, this.db[target].points);
            this.db[target].points -= actual;
            this.points += actual;
            this.addXP(15);
            this.saveDatabase();
            return {
                type: 'text',
                content: `🦹 You successfully robbed **${actual} pts** from **${target}**!`,
                botName: 'EconomyBot'
            };
        } else {
            const fine = Math.floor(Math.random() * 20) + 10;
            const actual = Math.min(fine, this.points);
            this.points -= actual;
            this.saveDatabase();
            return {
                type: 'text',
                content: `👮 You got caught robbing **${target}** and fined **${actual} pts**!`,
                botName: 'EconomyBot'
            };
        }
    }

    cmdPay(args) {
        if (args.length < 2) return { type: 'text', content: 'Usage: `.pay <user> <amount>`' };
        const target = args[0];
        let amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) return { type: 'text', content: '❌ Invalid amount.' };
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        if (target === this.username) return { type: 'text', content: "❌ You can't pay yourself!" };
        if (this.points < amount) return { type: 'text', content: `❌ You only have **${this.points} pts**.` };

        this.points -= amount;
        this.db[target].points += amount;
        this.saveDatabase();
        return { type: 'text', content: `💸 You paid **${amount} pts** to **${target}**!` };
    }

    cmdRPS(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.rps <rock|paper|scissors>`' };
        const userChoice = args[0].toLowerCase();
        const choices = ['rock', 'paper', 'scissors'];
        const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
        if (!choices.includes(userChoice)) return { type: 'text', content: '❌ Invalid choice. Use `rock`, `paper`, or `scissors`.' };

        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        let result;
        if (userChoice === botChoice) result = "It's a tie!";
        else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = '🏆 You win!';
        } else {
            result = '🤖 I win!';
        }

        return {
            type: 'text',
            content: `${emojis[userChoice]} vs ${emojis[botChoice]} — ${result}`,
            botName: 'TriviaBot'
        };
    }

    cmdTrivia() {
        const questions = [
            { q: 'What is the capital of France?', a: 'Paris', options: ['London', 'Berlin', 'Paris', 'Madrid'] },
            { q: 'How many sides does a hexagon have?', a: '6', options: ['5', '6', '7', '8'] },
            { q: 'What planet is known as the Red Planet?', a: 'Mars', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'] },
            { q: 'What is the chemical symbol for gold?', a: 'Au', options: ['Ag', 'Au', 'Fe', 'Cu'] },
            { q: 'Who wrote "Romeo and Juliet"?', a: 'Shakespeare', options: ['Dickens', 'Shakespeare', 'Hemingway', 'Tolstoy'] },
            { q: 'What is 2 to the power of 10?', a: '1024', options: ['512', '1000', '1024', '2048'] },
            { q: 'What is the largest ocean?', a: 'Pacific', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'] },
            { q: 'What does CPU stand for?', a: 'Central Processing Unit', options: ['Core Power Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Central Power Utility'] },
            { q: 'In which year did WW2 end?', a: '1945', options: ['1943', '1944', '1945', '1946'] },
            { q: 'What is the speed of light (approx)?', a: '300,000 km/s', options: ['150,000 km/s', '300,000 km/s', '500,000 km/s', '1,000,000 km/s'] }
        ];

        const q = questions[Math.floor(Math.random() * questions.length)];
        const shuffled = [...q.options].sort(() => Math.random() - 0.5);
        const letters = ['A', 'B', 'C', 'D'];
        const optionText = shuffled.map((o, i) => `**${letters[i]}.** ${o}`).join('\n');

        const correctLetter = letters[shuffled.indexOf(q.a)];
        // Store answer for a reveal after a timeout (simplified: show answer immediately since we have no state)
        return {
            type: 'embed',
            title: '🧠 Trivia Question!',
            fields: [
                { name: '❓ Question', value: q.q },
                { name: '🔤 Options', value: optionText },
                { name: '✅ Answer', value: `||**${correctLetter}. ${q.a}**|| (Use .trivia again for a new one!)` }
            ],
            color: 'default',
            botName: 'TriviaBot'
        };
    }

    cmd8Ball(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.8ball <question>`', botName: 'TriviaBot' };
        const answers = [
            '🟢 It is certain.', '🟢 It is decidedly so.', '🟢 Without a doubt.', '🟢 Yes — definitely.',
            '🟢 You may rely on it.', '🟢 As I see it, yes.', '🟢 Most likely.', '🟢 Outlook good.',
            '🟡 Reply hazy, try again.', '🟡 Ask again later.', '🟡 Better not tell you now.',
            '🔴 Don\'t count on it.', '🔴 My reply is no.', '🔴 My sources say no.',
            '🔴 Outlook not so good.', '🔴 Very doubtful.'
        ];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        return {
            type: 'text',
            content: `🎱 **${args.join(' ')}**\n> ${answer}`,
            botName: 'TriviaBot'
        };
    }

    cmdGive(args) {
        if (args.length < 2) return { type: 'text', content: 'Usage: `.give <user> <amount>`' };
        const target = args[0];
        let amount = parseInt(args[1]);
        if (isNaN(amount)) return { type: 'text', content: '❌ Invalid amount.' };
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        this.db[target].points += amount;
        this.saveDatabase();
        return { type: 'text', content: `✅ Admin gave **${amount} pts** to **${target}**.` };
    }

    cmdTake(args) {
        if (args.length < 2) return { type: 'text', content: 'Usage: `.take <user> <amount>`' };
        const target = args[0];
        let amount = parseInt(args[1]);
        if (isNaN(amount)) return { type: 'text', content: '❌ Invalid amount.' };
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        this.db[target].points = Math.max(0, (this.db[target].points || 0) - amount);
        this.saveDatabase();
        return { type: 'text', content: `✅ Admin took **${amount} pts** from **${target}**.` };
    }

    cmdSetRole(args) {
        if (args.length < 2) return { type: 'text', content: 'Usage: `.setrole <user> <role>`' };
        const target = args[0];
        const role = args[1];
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        const validRoles = ['Member', 'VIP', 'Admin', 'Owner'];
        const matched = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
        if (!matched) return { type: 'text', content: `❌ Invalid role. Valid: ${validRoles.join(', ')}` };
        this.db[target].role = matched;
        this.saveDatabase();
        return { type: 'system', action: 'update_roles', content: `✅ Set **${target}**'s role to **${matched}**.` };
    }

    cmdCreateChannel(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.createchannel <name>`' };
        const name = args[0].toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (this.channels.find(c => c.id === name)) {
            return { type: 'text', content: `❌ Channel **#${name}** already exists.` };
        }
        const topic = args.slice(1).join(' ') || 'New channel';
        this.channels.push({ id: name, name, topic });
        this.saveChannels();
        return { type: 'system', action: 'update_channels', content: `✅ Created channel **#${name}**.` };
    }

    cmdDeleteChannel(args) {
        if (args.length === 0) return { type: 'text', content: 'Usage: `.deletechannel <name>`' };
        const name = args[0].toLowerCase();
        if (['general'].includes(name)) return { type: 'text', content: '❌ Cannot delete the general channel.' };
        const idx = this.channels.findIndex(c => c.id === name);
        if (idx === -1) return { type: 'text', content: `❌ Channel **#${name}** not found.` };
        this.channels.splice(idx, 1);
        this.saveChannels();
        return { type: 'system', action: 'update_channels', content: `✅ Deleted channel **#${name}**.` };
    }

    cmdResetDB(args) {
        if (args.length === 0) {
            return { type: 'text', content: 'Usage: `.resetdb <user>` or `.resetdb ALL` — **DANGER: Resets user data!**' };
        }
        if (args[0] === 'ALL') {
            localStorage.removeItem('botData_allUsers');
            this.db = {};
            this.initUser();
            return { type: 'text', content: '⚠️ **All user data has been reset!**' };
        }
        const target = args[0];
        if (!this.db[target]) return { type: 'text', content: `❌ User **${target}** not found.` };
        delete this.db[target];
        this.saveDatabase();
        return { type: 'text', content: `✅ Reset data for **${target}**.` };
    }

    getUsersForSidebar() {
        const categorized = { 'ADMIN': [], 'VIP': [], 'ONLINE': [] };
        for (const [name, data] of Object.entries(this.db)) {
            let cat = 'ONLINE';
            if (data.role === 'Admin' || data.role === 'Owner') cat = 'ADMIN';
            else if (data.role === 'VIP') cat = 'VIP';
            categorized[cat].push({ name, role: data.role });
        }
        return categorized;
    }
}
