document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM References ───────────────────────────────────────────────────────
    const loginOverlay          = document.getElementById('login-overlay');
    const loginBtn              = document.getElementById('login-btn');
    const usernameInput         = document.getElementById('username-input');
    const savedAccountsSection  = document.getElementById('saved-accounts-section');
    const savedAccountsList     = document.getElementById('saved-accounts-list');

    const adminLoginOverlay     = document.getElementById('admin-login-overlay');
    const adminLoginBtn         = document.getElementById('admin-login-btn');
    const adminPasswordInput    = document.getElementById('admin-password-input');
    const adminCancelBtn        = document.getElementById('admin-cancel-btn');
    const adminToggleBtn        = document.getElementById('admin-toggle-btn');

    const appContainer          = document.getElementById('app');
    const currentUserAvatar     = document.getElementById('current-user-avatar');
    const currentUsername       = document.getElementById('current-username');
    const membersSidebar        = document.getElementById('members-sidebar');
    const channelsList          = document.getElementById('channels-list');
    const logoutBtn             = document.getElementById('logout-btn');
    const userInfoClick         = document.getElementById('user-info-click');

    const chatInput             = document.getElementById('chat-input');
    const messagesContainer     = document.getElementById('messages-container');
    const attachBtn             = document.getElementById('attach-btn');
    const fileUpload            = document.getElementById('file-upload');

    const channelNameHeader     = document.getElementById('channel-name-header');
    const channelTopicHeader    = document.getElementById('channel-topic-header');

    const emojiBtn              = document.getElementById('emoji-btn');
    const emojiPicker           = document.getElementById('emoji-picker');
    const headerSearchInput     = document.getElementById('header-search-input');
    const typingIndicator       = document.getElementById('typing-indicator');
    const toastContainer        = document.getElementById('toast-container');
    const createChannelBtn      = document.getElementById('admin-create-channel-btn');
    const onlineMemberCount     = document.getElementById('online-member-count');

    // ─── State ────────────────────────────────────────────────────────────────
    let username = '';
    let bot = null;
    let activeChannel = 'general';
    let channelMessages = {};
    let typingTimeout = null;
    let allMessages = [];

    // ─── Saved Accounts ───────────────────────────────────────────────────────
    function getSavedAccounts() {
        try { return JSON.parse(localStorage.getItem('savedAccounts') || '[]'); } catch { return []; }
    }

    function saveAccount(name) {
        const accounts = getSavedAccounts();
        if (!accounts.includes(name)) {
            accounts.unshift(name); // Most recent first
            if (accounts.length > 8) accounts.pop(); // Limit to 8
            localStorage.setItem('savedAccounts', JSON.stringify(accounts));
        } else {
            // Move to top
            const idx = accounts.indexOf(name);
            accounts.splice(idx, 1);
            accounts.unshift(name);
            localStorage.setItem('savedAccounts', JSON.stringify(accounts));
        }
    }

    function removeAccount(name) {
        let accounts = getSavedAccounts();
        accounts = accounts.filter(a => a !== name);
        localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }

    function getAvatarColor(name) {
        const colors = ['#f04747','#43b581','#faa61a','#7289da','#f47fff','#00b0f4','#ff6b6b','#a29bfe'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }

    function renderSavedAccounts() {
        const accounts = getSavedAccounts();
        if (accounts.length === 0) {
            savedAccountsSection.style.display = 'none';
            return;
        }
        savedAccountsSection.style.display = 'block';
        savedAccountsList.innerHTML = '';

        accounts.forEach(name => {
            // Try to get role from bot database
            let role = 'Member';
            try {
                const db = JSON.parse(localStorage.getItem('botData_allUsers') || '{}');
                if (db[name]) role = db[name].role || 'Member';
            } catch {}

            const roleColors = { Owner: '#e91e63', Admin: '#e91e63', VIP: '#f1c40f', Member: '#95a5a6' };
            const color = getAvatarColor(name);

            const item = document.createElement('button');
            item.className = 'saved-account-item';
            item.innerHTML = `
                <div class="saved-account-avatar" style="background:${color}">${name.charAt(0).toUpperCase()}</div>
                <div class="saved-account-info">
                    <div class="saved-account-name">${escapeHTML(name)}</div>
                    <div class="saved-account-role" style="color:${roleColors[role] || '#95a5a6'}">${role}</div>
                </div>
                <button class="saved-account-remove" title="Remove from list" data-name="${escapeHTML(name)}"><i class="fas fa-times"></i></button>
            `;

            // Click the main button = login as that account
            item.addEventListener('click', (e) => {
                if (e.target.closest('.saved-account-remove')) return;
                usernameInput.value = name;
                loginBtn.click();
            });

            // Remove button
            item.querySelector('.saved-account-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeAccount(name);
                renderSavedAccounts();
            });

            savedAccountsList.appendChild(item);
        });
    }

    // Render saved accounts on page load
    renderSavedAccounts();

    // ─── Login ────────────────────────────────────────────────────────────────
    loginBtn.addEventListener('click', () => {
        const val = usernameInput.value.trim();
        if (!val) {
            usernameInput.classList.add('shake');
            setTimeout(() => usernameInput.classList.remove('shake'), 400);
            return;
        }
        if (val.length < 2) { showToast('Username must be at least 2 characters.', 'error'); return; }
        if (val.length > 32) { showToast('Username too long (max 32 chars).', 'error'); return; }

        username = val;
        sessionStorage.setItem('fakeDiscordUsername', username);
        saveAccount(username);
        initializeChat();
    });

    usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') loginBtn.click(); });

    // ─── Logout / Switch Account ──────────────────────────────────────────────
    function logout() {
        sessionStorage.removeItem('fakeDiscordUsername');

        // Fade out
        appContainer.style.opacity = '0';
        appContainer.style.transition = 'opacity 0.3s';

        setTimeout(() => {
            appContainer.style.display = 'none';
            appContainer.style.opacity = '1';
            appContainer.style.transition = '';

            // Reset state
            username = '';
            bot = null;
            activeChannel = 'general';
            channelMessages = {};
            allMessages = [];
            messagesContainer.innerHTML = '';

            // Re-render login
            usernameInput.value = '';
            renderSavedAccounts();
            loginOverlay.style.display = 'flex';
            setTimeout(() => usernameInput.focus(), 100);
        }, 300);
    }

    logoutBtn.addEventListener('click', () => {
        if (confirm('Switch account? Your progress is saved.')) logout();
    });

    // Also clicking on own username in user-controls can switch
    userInfoClick.addEventListener('click', () => {
        if (confirm('Switch account? Your progress is saved.')) logout();
    });

    // ─── Admin Login ──────────────────────────────────────────────────────────
    adminToggleBtn.addEventListener('click', () => {
        if (!bot) return;
        if (bot.isAdmin) {
            bot.role = 'Member';
            bot.saveDatabase();
            updateUserUI();
            showToast('Admin privileges revoked.', 'info');
            return;
        }
        adminLoginOverlay.style.display = 'flex';
        adminPasswordInput.value = '';
        setTimeout(() => adminPasswordInput.focus(), 50);
    });

    adminCancelBtn.addEventListener('click', () => { adminLoginOverlay.style.display = 'none'; });
    adminPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') adminLoginBtn.click(); });
    adminLoginOverlay.addEventListener('click', e => {
        if (e.target === adminLoginOverlay) adminLoginOverlay.style.display = 'none';
    });

    adminLoginBtn.addEventListener('click', () => {
        if (adminPasswordInput.value === 'admin123') {
            bot.role = 'Owner';
            bot.saveDatabase();
            updateUserUI();
            adminLoginOverlay.style.display = 'none';
            showToast('Owner privileges granted! 👑', 'success');
            appendBotMessage('🔑 **System:** You have been granted **Owner** privileges. Welcome, boss!', 'SystemBot');
        } else {
            adminPasswordInput.classList.add('shake');
            setTimeout(() => adminPasswordInput.classList.remove('shake'), 400);
            showToast('Incorrect password!', 'error');
        }
    });

    // ─── File Upload ──────────────────────────────────────────────────────────
    attachBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', () => {
        const file = fileUpload.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { showToast('File too large (max 8MB).', 'error'); return; }
        const reader = new FileReader();
        reader.onload = e => {
            appendUserMessage('', e.target.result);
            showToast('Image uploaded!', 'success');
        };
        reader.readAsDataURL(file);
        fileUpload.value = '';
    });

    // ─── Emoji Picker ─────────────────────────────────────────────────────────
    const EMOJIS = [
        '😀','😂','🥲','😍','🤩','😎','🥳','😭','😤','🤔',
        '👍','👎','❤️','🔥','💯','🎉','🎰','🪙','💎','🎲',
        '🃏','🏆','💰','🎁','⭐','🐉','🦑','🐟','🐇','🐺',
        '🎣','🏹','🎮','🎵','💀','🤖','👑','✅','❌','⚡'
    ];
    EMOJIS.forEach(em => {
        const btn = document.createElement('button');
        btn.className = 'emoji-item';
        btn.textContent = em;
        btn.title = em;
        btn.addEventListener('click', () => {
            chatInput.value += em;
            chatInput.focus();
            emojiPicker.style.display = 'none';
        });
        emojiPicker.appendChild(btn);
    });

    emojiBtn.addEventListener('click', e => {
        e.stopPropagation();
        emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid';
    });
    document.addEventListener('click', e => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.style.display = 'none';
        }
    });

    // ─── Search ───────────────────────────────────────────────────────────────
    headerSearchInput.addEventListener('input', () => {
        const query = headerSearchInput.value.trim().toLowerCase();
        allMessages.forEach(m => {
            if (!query) { m.style.opacity = '1'; return; }
            const text = (m.querySelector('.message-text')?.textContent || '').toLowerCase();
            const author = (m.querySelector('.message-author')?.textContent || '').toLowerCase();
            m.style.opacity = (text.includes(query) || author.includes(query)) ? '1' : '0.15';
        });
    });

    // ─── Typing Indicator ─────────────────────────────────────────────────────
    chatInput.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        if (chatInput.value.length > 0) {
            typingIndicator.style.display = 'block';
            typingTimeout = setTimeout(() => { typingIndicator.style.display = 'none'; }, 2000);
        } else {
            typingIndicator.style.display = 'none';
        }
    });

    // ─── Admin create channel ──────────────────────────────────────────────────
    if (createChannelBtn) {
        createChannelBtn.addEventListener('click', () => {
            const name = prompt('New channel name:');
            if (name) handleBotResponse(bot.processCommand(`.createchannel ${name.trim()}`));
        });
    }

    // ─── Keyboard Shortcuts ────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); headerSearchInput.focus(); }
        if (e.key === 'Escape') {
            emojiPicker.style.display = 'none';
            if (headerSearchInput.value) { headerSearchInput.value = ''; allMessages.forEach(m => m.style.opacity = '1'); }
            adminLoginOverlay.style.display = 'none';
        }
    });

    // ─── Restore session ──────────────────────────────────────────────────────
    const savedUser = sessionStorage.getItem('fakeDiscordUsername');
    if (savedUser) {
        username = savedUser;
        initializeChat();
    } else {
        setTimeout(() => usernameInput.focus(), 100);
    }

    // ─── Initialize Chat ──────────────────────────────────────────────────────
    function initializeChat() {
        loginOverlay.style.display = 'none';
        appContainer.style.display = 'flex';

        bot = new CasinoBot(username);
        activeChannel = 'general';
        channelMessages = {};
        allMessages = [];

        updateUserUI();
        renderChannels();
        switchChannel('general');

        setTimeout(() => chatInput.focus(), 100);
    }

    // ─── Channels ─────────────────────────────────────────────────────────────
    function renderChannels() {
        channelsList.querySelectorAll('.channel').forEach(el => el.remove());
        if (createChannelBtn) createChannelBtn.style.display = bot.isAdmin ? 'block' : 'none';

        bot.channels.forEach(ch => {
            const el = document.createElement('div');
            el.className = 'channel' + (ch.id === activeChannel ? ' active' : '');
            el.dataset.channelId = ch.id;
            el.innerHTML = `<i class="fas fa-hashtag"></i><span>${escapeHTML(ch.name)}</span>`;
            el.addEventListener('click', () => switchChannel(ch.id));
            channelsList.appendChild(el);
        });
    }

    function switchChannel(channelId) {
        const ch = bot.channels.find(c => c.id === channelId);
        if (!ch) return;

        if (activeChannel) channelMessages[activeChannel] = messagesContainer.innerHTML;

        activeChannel = channelId;
        bot.activeChannel = channelId;

        if (channelNameHeader) channelNameHeader.textContent = ch.name;
        if (channelTopicHeader) channelTopicHeader.textContent = ch.topic;
        chatInput.placeholder = `Message #${ch.name}`;

        document.querySelectorAll('.channel').forEach(el => {
            el.classList.toggle('active', el.dataset.channelId === channelId);
        });

        messagesContainer.innerHTML = channelMessages[channelId] || '';
        allMessages = Array.from(messagesContainer.querySelectorAll('.message'));

        if (!channelMessages[channelId]) {
            appendBotMessage(`👋 Welcome to **#${ch.name}**! ${ch.topic}`);
        }
        scrollToBottom();
        chatInput.focus();
    }

    // ─── User UI ──────────────────────────────────────────────────────────────
    function getRoleClass(role) {
        if (role === 'Owner' || role === 'Admin') return 'role-admin';
        if (role === 'VIP') return 'role-vip';
        return 'role-member';
    }

    function updateUserUI() {
        const roleClass = getRoleClass(bot.role);
        currentUsername.textContent = username;
        currentUsername.className = `name ${roleClass}`;
        currentUserAvatar.textContent = username.charAt(0).toUpperCase();
        currentUserAvatar.style.backgroundColor = getAvatarColor(username);

        if (adminToggleBtn) {
            adminToggleBtn.className = bot.isAdmin ? 'fas fa-unlock' : 'fas fa-lock';
            adminToggleBtn.title = bot.isAdmin ? 'Revoke Admin' : 'Admin Login';
            adminToggleBtn.style.color = bot.isAdmin ? 'var(--role-admin)' : '';
        }
        if (createChannelBtn) createChannelBtn.style.display = bot.isAdmin ? 'block' : 'none';
        renderSidebar();
        renderChannels();
    }

    function renderSidebar() {
        membersSidebar.innerHTML = '';
        const usersObj = bot.getUsersForSidebar();
        const categories = ['ADMIN', 'VIP', 'ONLINE'];
        let totalOnline = 3;

        categories.forEach(cat => {
            const list = usersObj[cat];
            if (cat !== 'ONLINE' && list.length === 0) return;
            let count = list.length + (cat === 'ONLINE' ? 3 : 0);
            totalOnline += list.length;

            const catEl = document.createElement('div');
            catEl.className = 'members-category';
            catEl.textContent = `${cat} — ${count}`;
            membersSidebar.appendChild(catEl);

            if (cat === 'ONLINE') {
                [
                    { name: 'CasinoBot',  icon: 'fa-robot',   color: 'var(--brand-color)', activity: '🎰 Spinning slots' },
                    { name: 'TriviaBot',  icon: 'fa-question', color: '#f1c40f',            activity: '📚 Reading Wikipedia' },
                    { name: 'EconomyBot', icon: 'fa-coins',    color: '#2ecc71',            activity: '💰 Counting coins' }
                ].forEach(b => {
                    membersSidebar.insertAdjacentHTML('beforeend', `
                        <div class="member">
                            <div class="avatar bot-avatar" style="width:32px;height:32px;background:${b.color}">
                                <i class="fas ${b.icon}" style="font-size:14px"></i>
                                <div class="status-indicator online"></div>
                            </div>
                            <div class="member-details">
                                <span class="name role-member" style="font-size:13px">${b.name} <span class="bot-tag">BOT</span></span>
                                <span class="activity">${b.activity}</span>
                            </div>
                        </div>
                    `);
                });
            }

            list.forEach(u => {
                const rClass = getRoleClass(u.role);
                const isSelf = u.name === username;
                const statusColor = isSelf ? 'var(--online-color)' : 'var(--text-muted)';
                const avatarColor = getAvatarColor(u.name);
                membersSidebar.insertAdjacentHTML('beforeend', `
                    <div class="member" title="${escapeHTML(u.name)} — ${u.role}">
                        <div class="avatar" style="width:32px;height:32px;background:${avatarColor}">
                            ${u.name.charAt(0).toUpperCase()}
                            <div class="status-indicator" style="background:${statusColor}"></div>
                        </div>
                        <div class="member-details">
                            <span class="name ${rClass}" style="font-size:13px">${escapeHTML(u.name)}</span>
                            ${isSelf ? `<span class="activity">Chilling 😎</span>` : ''}
                        </div>
                    </div>
                `);
            });
        });

        if (onlineMemberCount) onlineMemberCount.textContent = totalOnline;
    }

    // ─── Message Input ────────────────────────────────────────────────────────
    chatInput.addEventListener('keypress', e => {
        if (e.key !== 'Enter') return;
        const text = chatInput.value.trim();
        if (!text) return;

        typingIndicator.style.display = 'none';
        clearTimeout(typingTimeout);
        appendUserMessage(text);
        chatInput.value = '';

        if (text.startsWith('.')) {
            showBotTyping();
            setTimeout(() => {
                hideBotTyping();
                handleBotResponse(bot.processCommand(text));
            }, 350 + Math.random() * 350);
        }
    });

    function handleBotResponse(response) {
        if (!response) return;
        const botName = response.botName || 'CasinoBot';
        if (response.type === 'text') {
            appendBotMessage(response.content, botName);
        } else if (response.type === 'embed') {
            appendBotEmbed(response, response.botName || botName);
        } else if (response.type === 'system') {
            if (response.content) appendBotMessage(response.content, 'SystemBot');
            if (response.action === 'update_roles') updateUserUI();
            else if (response.action === 'clear_chat') {
                messagesContainer.innerHTML = '';
                allMessages = [];
                channelMessages[activeChannel] = '';
            } else if (response.action === 'update_channels') {
                renderChannels();
            }
        }
    }

    // ─── Bot Typing ───────────────────────────────────────────────────────────
    let botTypingEl = null;
    function showBotTyping() {
        botTypingEl = document.createElement('div');
        botTypingEl.className = 'bot-typing';
        botTypingEl.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;"><i class="fas fa-robot" style="font-size:18px"></i></div>
            <div class="typing-dots"><span></span><span></span><span></span></div>
        `;
        messagesContainer.appendChild(botTypingEl);
        scrollToBottom();
    }
    function hideBotTyping() {
        if (botTypingEl) { botTypingEl.remove(); botTypingEl = null; }
    }

    // ─── Message Rendering ────────────────────────────────────────────────────
    function appendUserMessage(text, imageDataUrl = null) {
        const el = document.createElement('div');
        el.className = 'message';
        const roleClass = getRoleClass(bot.role);
        const avatarColor = getAvatarColor(username);
        el.innerHTML = `
            <div class="avatar" style="width:40px;height:40px;flex-shrink:0;background:${avatarColor};font-size:18px">${escapeHTML(username.charAt(0).toUpperCase())}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author ${roleClass}">${escapeHTML(username)}</span>
                    <span class="message-timestamp">${getTime()}</span>
                </div>
                ${text ? `<div class="message-text">${parseMarkdown(escapeHTML(text))}</div>` : ''}
                ${imageDataUrl ? `<img src="${imageDataUrl}" class="message-image" alt="Uploaded image">` : ''}
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    function appendBotMessage(text, botName = 'CasinoBot') {
        const { icon, color } = getBotStyle(botName);
        const el = document.createElement('div');
        el.className = 'message';
        el.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color};font-size:18px"><i class="fas ${icon}"></i></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color:${color}">${escapeHTML(botName)} <span class="bot-tag">BOT</span></span>
                    <span class="message-timestamp">${getTime()}</span>
                </div>
                <div class="message-text">${parseMarkdown(escapeHTML(text))}</div>
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    function appendBotEmbed(embedObj, botName = 'CasinoBot') {
        const { icon, color } = getBotStyle(botName);
        let embedClass = embedObj.color === 'win' ? 'win' : embedObj.color === 'lose' ? 'lose' : '';
        let fieldsHTML = (embedObj.fields || []).map(f => `
            <div class="embed-field">
                <div class="embed-field-name">${escapeHTML(f.name)}</div>
                <div class="embed-field-value">${parseMarkdown(escapeHTML(f.value))}</div>
            </div>
        `).join('');

        const el = document.createElement('div');
        el.className = 'message';
        el.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color};font-size:18px"><i class="fas ${icon}"></i></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color:${color}">${escapeHTML(botName)} <span class="bot-tag">BOT</span></span>
                    <span class="message-timestamp">${getTime()}</span>
                </div>
                <div class="embed ${embedClass}">
                    ${embedObj.title ? `<div class="embed-title">${escapeHTML(embedObj.title)}</div>` : ''}
                    <div class="embed-fields">${fieldsHTML}</div>
                </div>
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    function getBotStyle(name) {
        return {
            'CasinoBot':  { icon: 'fa-robot',     color: 'var(--brand-color)' },
            'TriviaBot':  { icon: 'fa-question',   color: '#f1c40f' },
            'EconomyBot': { icon: 'fa-coins',      color: '#2ecc71' },
            'SystemBot':  { icon: 'fa-shield-alt', color: '#e91e63' }
        }[name] || { icon: 'fa-robot', color: 'var(--brand-color)' };
    }

    function getMessageToolbar() {
        return `
            <div class="message-toolbar">
                <button class="toolbar-btn" title="Add Reaction" onclick="addReaction(this)">😄</button>
                <button class="toolbar-btn" title="Reply"><i class="fas fa-reply"></i></button>
                <button class="toolbar-btn" title="Pin"><i class="fas fa-thumbtack"></i></button>
                <button class="toolbar-btn delete-btn" title="Delete" onclick="deleteMessage(this)"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }

    // ─── Reactions ────────────────────────────────────────────────────────────
    window.addReaction = function(btn) {
        const quickEmojis = ['👍','❤️','😂','😮','😢','🔥','💯','🎉'];
        const msg = btn.closest('.message');
        let bar = msg.querySelector('.reaction-bar');
        if (!bar) { bar = document.createElement('div'); bar.className = 'reaction-bar'; msg.querySelector('.message-content').appendChild(bar); }
        const emoji = quickEmojis[Math.floor(Math.random() * quickEmojis.length)];
        const existing = [...bar.querySelectorAll('.reaction')].find(r => r.dataset.emoji === emoji);
        if (existing) {
            existing.dataset.count = parseInt(existing.dataset.count) + 1;
            existing.querySelector('.reaction-count').textContent = existing.dataset.count;
            existing.classList.add('reacted');
        } else {
            const r = document.createElement('button');
            r.className = 'reaction reacted'; r.dataset.emoji = emoji; r.dataset.count = 1;
            r.innerHTML = `${emoji} <span class="reaction-count">1</span>`;
            r.addEventListener('click', () => {
                r.dataset.count = parseInt(r.dataset.count) + 1;
                r.querySelector('.reaction-count').textContent = r.dataset.count;
                r.classList.toggle('reacted');
            });
            bar.appendChild(r);
        }
    };

    window.deleteMessage = function(btn) {
        const msg = btn.closest('.message');
        msg.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => { allMessages = allMessages.filter(m => m !== msg); msg.remove(); }, 200);
    };

    // ─── Toasts ───────────────────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        toast.innerHTML = `<span>${icons[type]}</span> ${escapeHTML(message)}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 400); }, 3200);
    }

    // ─── Utilities ────────────────────────────────────────────────────────────
    function getTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    function escapeHTML(str) {
        if (typeof str !== 'string') str = String(str ?? '');
        return str.replace(/[&<>'"]/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    }
    function parseMarkdown(str) {
        return str
            .replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/`(.*?)`/g, '<span class="highlight">$1</span>')
            .replace(/\n/g, '<br>');
    }
});
