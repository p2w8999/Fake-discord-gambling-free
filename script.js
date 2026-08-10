document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM References ────────────────────────────────────────────────────────
    const loginOverlay         = document.getElementById('login-overlay');
    const loginBtn             = document.getElementById('login-btn');
    const usernameInput        = document.getElementById('username-input');
    const savedAccountsSection = document.getElementById('saved-accounts-section');
    const savedAccountsList    = document.getElementById('saved-accounts-list');

    const adminLoginOverlay    = document.getElementById('admin-login-overlay');
    const adminLoginBtn        = document.getElementById('admin-login-btn');
    const adminPasswordInput   = document.getElementById('admin-password-input');
    const adminCancelBtn       = document.getElementById('admin-cancel-btn');
    const adminToggleBtn       = document.getElementById('admin-toggle-btn');

    const createServerOverlay  = document.getElementById('create-server-overlay');
    const createServerBtn      = document.getElementById('create-server-btn');
    const createServerCancelBtn= document.getElementById('create-server-cancel-btn');
    const newServerName        = document.getElementById('new-server-name');
    const newServerDesc        = document.getElementById('new-server-desc');
    const serverEmojiBtn       = document.getElementById('server-emoji-btn');
    const serverEmojiPicker    = document.getElementById('server-emoji-picker');
    const addServerBtn         = document.getElementById('add-server-btn');

    const serverSettingsOverlay= document.getElementById('server-settings-overlay');
    const serverSettingsName   = document.getElementById('settings-server-name');
    const serverSettingsCancel = document.getElementById('server-settings-cancel-btn');
    const settingsSaveBtn      = document.getElementById('settings-save-btn');
    const settingsDeleteBtn    = document.getElementById('settings-delete-btn');
    const serverSettingsNameDisplay = document.getElementById('server-settings-name-display');
    const settingsChannelsList = document.getElementById('settings-channels-list');

    const channelPermsOverlay  = document.getElementById('channel-perms-overlay');
    const channelPermsTitle    = document.getElementById('channel-perms-title');
    const channelPermsBody     = document.getElementById('channel-perms-body');
    const channelPermsSaveBtn  = document.getElementById('channel-perms-save-btn');
    const channelPermsCancelBtn= document.getElementById('channel-perms-cancel-btn');

    const appContainer         = document.getElementById('app');
    const currentUserAvatar    = document.getElementById('current-user-avatar');
    const currentUsernameEl    = document.getElementById('current-username');
    const currentUserStatus    = document.getElementById('current-user-status');
    const membersSidebar       = document.getElementById('members-sidebar');
    const channelsList         = document.getElementById('channels-list');
    const logoutBtn            = document.getElementById('logout-btn');
    const userInfoClick        = document.getElementById('user-info-click');
    const serverNav            = document.getElementById('server-nav');

    const chatInput            = document.getElementById('chat-input');
    const messagesContainer    = document.getElementById('messages-container');
    const attachBtn            = document.getElementById('attach-btn');
    const fileUpload           = document.getElementById('file-upload');
    const inputArea            = document.getElementById('input-area');

    const channelNameHeader    = document.getElementById('channel-name-header');
    const channelTopicHeader   = document.getElementById('channel-topic-header');
    const channelIconHeader    = document.getElementById('channel-icon-header');
    const serverNameHeader     = document.getElementById('server-name-header');
    const serverBannerText     = document.getElementById('server-banner-text');
    const serverBannerSub      = document.getElementById('server-banner-sub');
    const serverBannerBadge    = document.getElementById('server-banner-badge');
    const serverHeaderBtn      = document.getElementById('server-header-btn');

    const emojiBtn             = document.getElementById('emoji-btn');
    const emojiPicker          = document.getElementById('emoji-picker');
    const headerSearchInput    = document.getElementById('header-search-input');
    const typingIndicator      = document.getElementById('typing-indicator');
    const toastContainer       = document.getElementById('toast-container');
    const createChannelBtn     = document.getElementById('admin-create-channel-btn');
    const onlineMemberCount    = document.getElementById('online-member-count');
    const readonlyBadge        = document.getElementById('readonly-badge');
    const lockedChannelBar     = document.getElementById('locked-channel-bar');
    const lockedChannelMsg     = document.getElementById('locked-channel-msg');
    const slowmodeBar          = document.getElementById('slowmode-bar');
    const slowmodeSeconds      = document.getElementById('slowmode-seconds');
    const micBtn               = document.getElementById('mic-btn');
    const deafBtn              = document.getElementById('deaf-btn');

    // ─── State ─────────────────────────────────────────────────────────────────
    let username       = '';
    let bot            = null;
    let activeChannel  = 'general';
    let activeServerId = 'gaming-central';
    let channelMessages = {};  // in-memory cache: { channelId: innerHTML }
    let typingTimeout  = null;
    let allMessages    = [];
    let giveawayTimer  = null;
    let slowmodeTimers = {};
    let lastMsgTime    = 0;
    let isMicMuted     = false;
    let isDeafened     = false;
    let selectedServerEmoji = '🎮';
    let editingChannelPerms = null; // { channelId, pendingPerms }

    // ─── Servers Manager ───────────────────────────────────────────────────────
    function loadServers() {
        try { return JSON.parse(localStorage.getItem('discord_servers') || '{}'); } catch { return {}; }
    }
    function saveServers(servers) {
        localStorage.setItem('discord_servers', JSON.stringify(servers));
    }
    function ensureDefaultServer() {
        const servers = loadServers();
        if (!servers['gaming-central']) {
            servers['gaming-central'] = {
                name: 'Gaming Central',
                icon: '🎮',
                description: 'The original gaming community server!',
                ownerId: 'System',
                createdAt: Date.now()
            };
            saveServers(servers);
        }
        return servers;
    }
    function createServer(name, icon, description) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) + '-' + Date.now().toString(36);
        const servers = loadServers();
        servers[id] = { name, icon, description, ownerId: username, createdAt: Date.now() };
        saveServers(servers);
        return id;
    }
    function deleteServer(serverId) {
        if (serverId === 'gaming-central') return false;
        const servers = loadServers();
        delete servers[serverId];
        saveServers(servers);
        // Also clean up channels and messages for this server
        localStorage.removeItem(`botData_channels_${serverId}`);
        // Clean message keys
        const keys = Object.keys(localStorage).filter(k => k.startsWith(`msgs_${serverId}_`));
        keys.forEach(k => localStorage.removeItem(k));
        return true;
    }

    // ─── Message Persistence ───────────────────────────────────────────────────
    const MSG_VERSION = 1;
    function getMsgKey(serverId, channelId) {
        return `msgs_${serverId}_${channelId}`;
    }
    function saveMessages(serverId, channelId, messages) {
        try {
            const data = { v: MSG_VERSION, msgs: messages };
            localStorage.setItem(getMsgKey(serverId, channelId), JSON.stringify(data));
        } catch(e) { /* quota */ }
    }
    function loadMessages(serverId, channelId) {
        try {
            const raw = localStorage.getItem(getMsgKey(serverId, channelId));
            if (!raw) return [];
            const data = JSON.parse(raw);
            return data.msgs || [];
        } catch { return []; }
    }
    // Stored messages: { type: 'user'|'bot'|'embed'|'system'|'ai', author, text, timestamp, role, botName?, imageUrl?, embedData? }
    let channelMsgStore = {}; // { channelId: [{msg obj}] }

    function storeMsg(channelId, msgObj) {
        if (!channelMsgStore[channelId]) channelMsgStore[channelId] = [];
        channelMsgStore[channelId].push(msgObj);
        // Persist immediately
        saveMessages(activeServerId, channelId, channelMsgStore[channelId]);
    }

    // ─── Saved Accounts ────────────────────────────────────────────────────────
    function getSavedAccounts() {
        try { return JSON.parse(localStorage.getItem('savedAccounts') || '[]'); } catch { return []; }
    }
    function saveAccount(name) {
        const accounts = getSavedAccounts();
        const idx = accounts.indexOf(name);
        if (idx > -1) accounts.splice(idx, 1);
        accounts.unshift(name);
        if (accounts.length > 8) accounts.pop();
        localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }
    function removeAccount(name) {
        let accounts = getSavedAccounts().filter(a => a !== name);
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
        if (!accounts.length) { savedAccountsSection.style.display = 'none'; return; }
        savedAccountsSection.style.display = 'block';
        savedAccountsList.innerHTML = '';
        accounts.forEach(name => {
            let role = 'Member';
            try { const db = JSON.parse(localStorage.getItem('botData_allUsers') || '{}'); if (db[name]) role = db[name].role || 'Member'; } catch {}
            const roleColors = { Owner:'#e91e63', Admin:'#e91e63', VIP:'#f1c40f', Member:'#95a5a6' };
            const color = getAvatarColor(name);
            const item = document.createElement('button');
            item.className = 'saved-account-item';
            item.innerHTML = `
                <div class="saved-account-avatar" style="background:${color}">${name.charAt(0).toUpperCase()}</div>
                <div class="saved-account-info">
                    <div class="saved-account-name">${escapeHTML(name)}</div>
                    <div class="saved-account-role" style="color:${roleColors[role]||'#95a5a6'}">${role}</div>
                </div>
                <button class="saved-account-remove" title="Remove" data-name="${escapeHTML(name)}"><i class="fas fa-times"></i></button>
            `;
            item.addEventListener('click', e => {
                if (e.target.closest('.saved-account-remove')) return;
                usernameInput.value = name; loginBtn.click();
            });
            item.querySelector('.saved-account-remove').addEventListener('click', e => {
                e.stopPropagation(); removeAccount(name); renderSavedAccounts();
            });
            savedAccountsList.appendChild(item);
        });
    }
    renderSavedAccounts();

    // ─── Login ─────────────────────────────────────────────────────────────────
    loginBtn.addEventListener('click', () => {
        const val = usernameInput.value.trim();
        if (!val) { usernameInput.classList.add('shake'); setTimeout(() => usernameInput.classList.remove('shake'), 400); return; }
        if (val.length < 2) { showToast('Username must be at least 2 characters.', 'error'); return; }
        if (val.length > 32) { showToast('Username too long (max 32 chars).', 'error'); return; }
        username = val;
        sessionStorage.setItem('fakeDiscordUsername', username);
        saveAccount(username);
        initializeChat();
    });
    usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') loginBtn.click(); });

    // ─── Logout / Switch ───────────────────────────────────────────────────────
    function logout() {
        sessionStorage.removeItem('fakeDiscordUsername');
        clearGiveawayTimer();
        appContainer.style.opacity = '0';
        appContainer.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            appContainer.style.display = 'none';
            appContainer.style.opacity = '1'; appContainer.style.transition = '';
            username = ''; bot = null; activeChannel = 'general';
            channelMessages = {}; channelMsgStore = {}; allMessages = []; messagesContainer.innerHTML = '';
            usernameInput.value = '';
            renderSavedAccounts();
            loginOverlay.style.display = 'flex';
            setTimeout(() => usernameInput.focus(), 100);
        }, 300);
    }
    logoutBtn.addEventListener('click', () => { if (confirm('Switch account? Progress is saved.')) logout(); });
    userInfoClick.addEventListener('click', () => { if (confirm('Switch account? Progress is saved.')) logout(); });

    // ─── Admin Login ───────────────────────────────────────────────────────────
    adminToggleBtn.addEventListener('click', () => {
        if (!bot) return;
        if (bot.isAdmin) { bot.role = 'Member'; bot.saveDatabase(); updateUserUI(); showToast('Admin privileges revoked.', 'info'); return; }
        adminLoginOverlay.style.display = 'flex'; adminPasswordInput.value = '';
        setTimeout(() => adminPasswordInput.focus(), 50);
    });
    adminCancelBtn.addEventListener('click', () => { adminLoginOverlay.style.display = 'none'; });
    adminPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') adminLoginBtn.click(); });
    adminLoginOverlay.addEventListener('click', e => { if (e.target === adminLoginOverlay) adminLoginOverlay.style.display = 'none'; });
    adminLoginBtn.addEventListener('click', () => {
        if (adminPasswordInput.value === BOT_CONFIG.adminPassword) {
            bot.role = 'Owner'; bot.saveDatabase(); updateUserUI();
            adminLoginOverlay.style.display = 'none';
            showToast('Owner privileges granted! 👑', 'success');
            appendBotMessage('🔑 **System:** You have been granted **Owner** privileges. Welcome, boss!', 'SystemBot');
        } else {
            adminPasswordInput.classList.add('shake');
            setTimeout(() => adminPasswordInput.classList.remove('shake'), 400);
            showToast('Incorrect password!', 'error');
        }
    });

    // ─── Server Emoji Picker ───────────────────────────────────────────────────
    const SERVER_EMOJIS = ['🎮','🎲','🎰','🎵','🎸','🎤','🏆','⚔️','🧙','🚀','🌍','🔥','💎','🌈','⭐','🏰','🦁','🐉','🤖','💻','🎭','🎨','📚','🏋️','🎯','🍕','🎉','💥','🌟','🛡️'];
    SERVER_EMOJIS.forEach(em => {
        const btn = document.createElement('button');
        btn.className = 'server-emoji-item'; btn.textContent = em;
        btn.addEventListener('click', () => {
            selectedServerEmoji = em;
            serverEmojiBtn.textContent = em;
            serverEmojiPicker.style.display = 'none';
        });
        serverEmojiPicker.appendChild(btn);
    });
    serverEmojiBtn.addEventListener('click', e => {
        e.stopPropagation();
        serverEmojiPicker.style.display = serverEmojiPicker.style.display === 'grid' ? 'none' : 'grid';
    });
    document.addEventListener('click', e => {
        if (!serverEmojiPicker.contains(e.target) && e.target !== serverEmojiBtn) {
            serverEmojiPicker.style.display = 'none';
        }
    });

    // ─── Create Server Modal ───────────────────────────────────────────────────
    addServerBtn.addEventListener('click', () => {
        createServerOverlay.style.display = 'flex';
        newServerName.value = ''; newServerDesc.value = '';
        selectedServerEmoji = '🎮'; serverEmojiBtn.textContent = '🎮';
        setTimeout(() => newServerName.focus(), 50);
    });
    createServerCancelBtn.addEventListener('click', () => { createServerOverlay.style.display = 'none'; });
    createServerOverlay.addEventListener('click', e => { if (e.target === createServerOverlay) createServerOverlay.style.display = 'none'; });
    createServerBtn.addEventListener('click', () => {
        const name = newServerName.value.trim();
        if (!name) { newServerName.classList.add('shake'); setTimeout(() => newServerName.classList.remove('shake'), 400); return; }
        if (name.length < 2) { showToast('Server name must be at least 2 characters.', 'error'); return; }
        const desc = newServerDesc.value.trim() || 'A brand new server!';
        const newId = createServer(name, selectedServerEmoji, desc);
        createServerOverlay.style.display = 'none';
        showToast(`Server "${name}" created! 🎉`, 'success');
        renderServerNav();
        switchServer(newId);
    });
    newServerName.addEventListener('keypress', e => { if (e.key === 'Enter') createServerBtn.click(); });

    // ─── Server Settings Modal ─────────────────────────────────────────────────
    serverHeaderBtn.addEventListener('click', () => {
        if (!bot || !bot.isAdmin) { showToast('Only Admins can access server settings.', 'error'); return; }
        const servers = loadServers();
        const sv = servers[activeServerId] || {};
        serverSettingsNameDisplay.textContent = sv.name || 'Gaming Central';
        serverSettingsName.value = sv.name || '';
        serverSettingsOverlay.style.display = 'flex';
        renderSettingsChannels();
    });
    serverSettingsCancel.addEventListener('click', () => { serverSettingsOverlay.style.display = 'none'; });
    serverSettingsOverlay.addEventListener('click', e => { if (e.target === serverSettingsOverlay) serverSettingsOverlay.style.display = 'none'; });
    settingsSaveBtn.addEventListener('click', () => {
        const newName = serverSettingsName.value.trim();
        if (!newName) { showToast('Server name cannot be empty.', 'error'); return; }
        const servers = loadServers();
        if (servers[activeServerId]) {
            servers[activeServerId].name = newName;
            saveServers(servers);
        }
        serverSettingsOverlay.style.display = 'none';
        renderServerNav();
        updateServerHeader();
        showToast('Server settings saved!', 'success');
    });
    settingsDeleteBtn.addEventListener('click', () => {
        if (activeServerId === 'gaming-central') { showToast('Cannot delete the main server!', 'error'); return; }
        if (!confirm(`Delete server "${loadServers()[activeServerId]?.name}"? This cannot be undone!`)) return;
        deleteServer(activeServerId);
        switchServer('gaming-central');
        renderServerNav();
        serverSettingsOverlay.style.display = 'none';
        showToast('Server deleted.', 'info');
    });

    function renderSettingsChannels() {
        if (!bot) return;
        settingsChannelsList.innerHTML = '';
        bot.channels.forEach(ch => {
            const row = document.createElement('div');
            row.className = 'settings-channel-row';
            row.innerHTML = `
                <span class="settings-ch-name"><i class="fas fa-hashtag"></i> ${escapeHTML(ch.name)}</span>
                <button class="settings-ch-perms-btn" data-id="${ch.id}" title="Edit Permissions"><i class="fas fa-shield-alt"></i> Permissions</button>
            `;
            row.querySelector('.settings-ch-perms-btn').addEventListener('click', () => {
                openChannelPermsModal(ch.id);
            });
            settingsChannelsList.appendChild(row);
        });
    }

    // ─── Channel Permissions Modal ─────────────────────────────────────────────
    function openChannelPermsModal(channelId) {
        const ch = bot.channels.find(c => c.id === channelId);
        if (!ch) return;
        channelPermsTitle.textContent = `#${ch.name}`;
        editingChannelPerms = { channelId, pendingPerms: { ...(ch.permissions || {}) } };

        const roles = ['Member', 'VIP', 'Admin', 'Owner'];
        channelPermsBody.innerHTML = '';
        roles.forEach(role => {
            const cur = editingChannelPerms.pendingPerms[role] || 'inherit';
            const row = document.createElement('div');
            row.className = 'perm-row';
            row.innerHTML = `
                <span class="perm-role">${role}</span>
                <div class="perm-options">
                    <label class="perm-opt"><input type="radio" name="perm_${role}" value="allow" ${cur==='allow'?'checked':''}> <span class="perm-allow">✅ Allow</span></label>
                    <label class="perm-opt"><input type="radio" name="perm_${role}" value="deny"  ${cur==='deny' ?'checked':''}> <span class="perm-deny">❌ Deny</span></label>
                    <label class="perm-opt"><input type="radio" name="perm_${role}" value="inherit" ${cur==='inherit'||!cur?'checked':''}> <span class="perm-inherit">⬜ Inherit</span></label>
                </div>
            `;
            channelPermsBody.appendChild(row);
        });

        serverSettingsOverlay.style.display = 'none';
        channelPermsOverlay.style.display = 'flex';
    }
    channelPermsSaveBtn.addEventListener('click', () => {
        if (!editingChannelPerms) return;
        const { channelId } = editingChannelPerms;
        const roles = ['Member', 'VIP', 'Admin', 'Owner'];
        roles.forEach(role => {
            const sel = channelPermsBody.querySelector(`input[name="perm_${role}"]:checked`);
            if (sel) {
                if (sel.value === 'inherit') {
                    bot.setChannelPermission(channelId, role, 'inherit');
                } else {
                    bot.setChannelPermission(channelId, role, sel.value);
                }
            }
        });
        channelPermsOverlay.style.display = 'none';
        renderChannels();
        showToast('Permissions saved!', 'success');
    });
    channelPermsCancelBtn.addEventListener('click', () => { channelPermsOverlay.style.display = 'none'; });

    // ─── Mic / Deafen toggles (cosmetic) ──────────────────────────────────────
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            isMicMuted = !isMicMuted;
            micBtn.className = isMicMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
            micBtn.style.color = isMicMuted ? 'var(--error-color)' : '';
            showToast(isMicMuted ? '🔇 Microphone muted' : '🎤 Microphone unmuted', 'info');
        });
    }
    if (deafBtn) {
        deafBtn.addEventListener('click', () => {
            isDeafened = !isDeafened;
            deafBtn.className = isDeafened ? 'fas fa-deaf' : 'fas fa-headphones';
            deafBtn.style.color = isDeafened ? 'var(--error-color)' : '';
            showToast(isDeafened ? '🔇 Deafened' : '🎧 Undeafened', 'info');
        });
    }

    // ─── File Upload ───────────────────────────────────────────────────────────
    attachBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', () => {
        const file = fileUpload.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { showToast('File too large (max 8MB).', 'error'); return; }
        const reader = new FileReader();
        reader.onload = e => { appendUserMessage('', e.target.result); showToast('Image uploaded!', 'success'); };
        reader.readAsDataURL(file);
        fileUpload.value = '';
    });

    // ─── Emoji Picker ──────────────────────────────────────────────────────────
    const EMOJIS = [
        '😀','😂','🥲','😍','🤩','😎','🥳','😭','😤','🤔',
        '👍','👎','❤️','🔥','💯','🎉','🎰','🪙','💎','🎲',
        '🃏','🏆','💰','🎁','⭐','🐉','🦑','🐟','🐇','🐺',
        '🎣','🏹','🎮','🎵','💀','🤖','👑','✅','❌','⚡',
        '🎸','🥇','🍕','🎂','💪','🌟','🦁','🐯','🎭','🤣'
    ];
    EMOJIS.forEach(em => {
        const btn = document.createElement('button');
        btn.className = 'emoji-item'; btn.textContent = em; btn.title = em;
        btn.addEventListener('click', () => { chatInput.value += em; chatInput.focus(); emojiPicker.style.display = 'none'; });
        emojiPicker.appendChild(btn);
    });
    emojiBtn.addEventListener('click', e => { e.stopPropagation(); emojiPicker.style.display = emojiPicker.style.display === 'grid' ? 'none' : 'grid'; });
    document.addEventListener('click', e => { if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) emojiPicker.style.display = 'none'; });

    // ─── Search ────────────────────────────────────────────────────────────────
    headerSearchInput.addEventListener('input', () => {
        const query = headerSearchInput.value.trim().toLowerCase();
        allMessages.forEach(m => {
            if (!query) { m.style.opacity = '1'; return; }
            const text = (m.querySelector('.message-text')?.textContent || '').toLowerCase();
            const author = (m.querySelector('.message-author')?.textContent || '').toLowerCase();
            m.style.opacity = (text.includes(query) || author.includes(query)) ? '1' : '0.15';
        });
    });

    // ─── Typing Indicator ──────────────────────────────────────────────────────
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
            serverEmojiPicker.style.display = 'none';
            if (headerSearchInput.value) { headerSearchInput.value = ''; allMessages.forEach(m => m.style.opacity = '1'); }
            adminLoginOverlay.style.display = 'none';
            createServerOverlay.style.display = 'none';
            serverSettingsOverlay.style.display = 'none';
            channelPermsOverlay.style.display = 'none';
        }
    });

    // ─── Session Restore ───────────────────────────────────────────────────────
    const savedUser = sessionStorage.getItem('fakeDiscordUsername');
    if (savedUser) { username = savedUser; initializeChat(); }
    else setTimeout(() => usernameInput.focus(), 100);

    // ─── Initialize Chat ───────────────────────────────────────────────────────
    function initializeChat() {
        ensureDefaultServer();
        loginOverlay.style.display = 'none';
        appContainer.style.display = 'flex';
        activeServerId = localStorage.getItem('discord_active_server') || 'gaming-central';
        // Ensure that active server exists
        const servers = loadServers();
        if (!servers[activeServerId]) activeServerId = 'gaming-central';
        bot = new CasinoBot(username, activeServerId);
        activeChannel = 'general';
        channelMessages = {}; channelMsgStore = {}; allMessages = [];
        updateUserUI();
        renderServerNav();
        updateServerHeader();
        renderChannels();
        switchChannel('general');
        setTimeout(() => chatInput.focus(), 100);
    }

    // ─── Server Nav ────────────────────────────────────────────────────────────
    function renderServerNav() {
        // Remove existing server icons (keep discord logo, divider, add btn, explore btn)
        serverNav.querySelectorAll('.server-icon.user-server').forEach(el => el.remove());

        const servers = loadServers();
        const divider = serverNav.querySelector('.divider');

        Object.entries(servers).forEach(([id, sv]) => {
            const icon = document.createElement('div');
            icon.className = 'server-icon user-server' + (id === activeServerId ? ' active' : '');
            icon.title = sv.name;
            icon.dataset.serverId = id;
            icon.innerHTML = `<span>${sv.icon || sv.name.charAt(0).toUpperCase()}</span>`;
            icon.addEventListener('click', () => switchServer(id));
            icon.addEventListener('contextmenu', e => {
                e.preventDefault();
                if (bot && bot.isAdmin && id === activeServerId) {
                    serverHeaderBtn.click();
                }
            });
            divider.insertAdjacentElement('afterend', icon);
        });
    }

    // ─── Switch Server ─────────────────────────────────────────────────────────
    function switchServer(serverId) {
        const servers = loadServers();
        if (!servers[serverId]) return;

        // Save current channel messages before switching
        if (bot) saveChannelMessages();

        activeServerId = serverId;
        localStorage.setItem('discord_active_server', serverId);

        bot = new CasinoBot(username, serverId);
        activeChannel = 'general';
        channelMessages = {}; channelMsgStore = {}; allMessages = []; messagesContainer.innerHTML = '';

        updateUserUI();
        renderServerNav();
        updateServerHeader();
        renderChannels();
        switchChannel('general');
    }

    function saveChannelMessages() {
        // already done per-message via storeMsg; this is a final flush
        if (channelMsgStore[activeChannel]) {
            saveMessages(activeServerId, activeChannel, channelMsgStore[activeChannel]);
        }
    }

    function updateServerHeader() {
        const servers = loadServers();
        const sv = servers[activeServerId] || { name: 'Gaming Central', icon: '🎮', description: 'Gaming community!' };
        if (serverNameHeader) serverNameHeader.textContent = sv.name;
        if (serverBannerText) serverBannerText.textContent = sv.name;
        if (serverBannerSub)  serverBannerSub.textContent  = sv.description || 'Join the community!';
        if (serverBannerBadge) serverBannerBadge.textContent = `${sv.icon || '🎮'} LIVE`;
    }

    // ─── Channels ──────────────────────────────────────────────────────────────
    const INFO_CHANNELS = ['announcements', 'rules'];

    function renderChannels() {
        channelsList.querySelectorAll('.channel,.channel-divider,.category-separator').forEach(el => el.remove());
        if (createChannelBtn) createChannelBtn.style.display = bot.isAdmin ? 'block' : 'none';

        const infoChannels = bot.channels.filter(ch => INFO_CHANNELS.includes(ch.id));
        const textChannels = bot.channels.filter(ch => !INFO_CHANNELS.includes(ch.id));

        const categories = channelsList.querySelectorAll('.category');
        const infoCategory = categories[0];
        const textCategory = categories[1];

        infoChannels.forEach(ch => {
            const el = buildChannelEl(ch);
            infoCategory.insertAdjacentElement('afterend', el);
        });

        let lastEl = textCategory;
        textChannels.forEach(ch => {
            const el = buildChannelEl(ch);
            lastEl.insertAdjacentElement('afterend', el);
            lastEl = el;
        });
    }

    function buildChannelEl(ch) {
        const el = document.createElement('div');
        const canAccess = bot.checkChannelPermission(ch.id);
        const isLocked = (ch.locked || Object.values(ch.permissions || {}).includes('deny')) && !canAccess;
        el.className = 'channel' + (ch.id === activeChannel ? ' active' : '') + (isLocked ? ' channel-locked' : '');
        el.dataset.channelId = ch.id;

        const iconMap = {
            'announcements': 'fa-bullhorn', 'rules': 'fa-gavel', 'music': 'fa-music',
            'giveaways': 'fa-gift', 'vip-lounge': 'fa-star', 'casino': 'fa-dice',
            'economy': 'fa-coins', 'trivia': 'fa-brain', 'leaderboard': 'fa-trophy',
            'bot-commands': 'fa-robot', 'memes': 'fa-laugh', 'ai-chat': 'fa-microchip'
        };
        const iconClass = iconMap[ch.id] || 'fa-hashtag';
        const lockIcon = isLocked ? '<i class="fas fa-lock channel-lock-icon"></i>' : '';
        const unreadDot = ch.id !== activeChannel ? '<span class="unread-dot" style="display:none;"></span>' : '';

        // Admin: right-click to edit permissions
        el.innerHTML = `<i class="fas ${iconClass}"></i><span>${escapeHTML(ch.name)}</span>${lockIcon}${unreadDot}`;
        el.addEventListener('click', () => switchChannel(ch.id));
        if (bot.isAdmin) {
            el.addEventListener('contextmenu', e => {
                e.preventDefault();
                openChannelPermsModal(ch.id);
            });
        }
        return el;
    }

    function switchChannel(channelId) {
        const ch = bot.channels.find(c => c.id === channelId);
        if (!ch) return;

        // Save current channel's message store
        if (activeChannel && channelMsgStore[activeChannel]) {
            saveMessages(activeServerId, activeChannel, channelMsgStore[activeChannel]);
        }

        activeChannel = channelId;
        bot.activeChannel = channelId;

        if (channelNameHeader) channelNameHeader.textContent = ch.name;
        if (channelTopicHeader) channelTopicHeader.textContent = ch.topic;
        if (chatInput) chatInput.placeholder = `Message #${ch.name}`;

        const iconMap = {
            'announcements': 'fa-bullhorn', 'rules': 'fa-gavel', 'music': 'fa-music',
            'giveaways': 'fa-gift', 'vip-lounge': 'fa-star', 'casino': 'fa-dice',
            'economy': 'fa-coins', 'trivia': 'fa-brain', 'leaderboard': 'fa-trophy',
            'bot-commands': 'fa-robot', 'memes': 'fa-laugh', 'ai-chat': 'fa-microchip'
        };
        if (channelIconHeader) channelIconHeader.className = `fas ${iconMap[ch.id] || 'fa-hashtag'}`;

        document.querySelectorAll('.channel').forEach(el => {
            el.classList.toggle('active', el.dataset.channelId === channelId);
        });

        const canPost = bot.checkChannelPermission(channelId);
        if (ch.locked && !canPost) {
            lockedChannelBar.style.display = 'flex';
            inputArea.style.display = 'none';
            const req = ch.requiredRole === 'Admin' ? 'Admin/Owner' : 'VIP or higher';
            lockedChannelMsg.textContent = `🔒 You need ${req} to post in #${ch.name}.`;
            readonlyBadge.style.display = 'flex';
        } else {
            lockedChannelBar.style.display = 'none';
            inputArea.style.display = '';
            readonlyBadge.style.display = 'none';
        }

        const sm = bot.slowmodeMap?.[channelId] || 0;
        if (sm > 0) {
            slowmodeBar.style.display = 'flex';
            slowmodeSeconds.textContent = Math.ceil(sm / 1000);
        } else {
            slowmodeBar.style.display = 'none';
        }

        // Load persisted messages
        messagesContainer.innerHTML = '';
        allMessages = [];

        const stored = loadMessages(activeServerId, channelId);
        channelMsgStore[channelId] = stored;

        if (stored.length > 0) {
            // Re-render stored messages
            stored.forEach(msg => renderStoredMsg(msg));
        } else {
            // First-time channel visit: show welcome
            if (channelId === 'announcements') {
                appendAnnouncementBanner();
            } else if (channelId === 'rules') {
                appendRulesBanner();
            } else if (channelId === 'vip-lounge') {
                appendVipBanner();
            } else if (channelId === 'music') {
                appendBotMessage('🎵 Welcome to **#music**! Use `.play <song name>` to queue a track, `.skip` to skip, `.queue` to see the queue, and `.np` to see what\'s playing.', 'MusicBot');
            } else if (channelId === 'giveaways') {
                appendBotMessage('🎁 Welcome to **#giveaways**! Admins can start giveaways with `.giveaway <prize> <seconds>`. Use `.enter` to join an active giveaway!', 'GiveawayBot');
            } else if (channelId === 'ai-chat') {
                appendBotMessage(`🤖 Welcome to **#ai-chat**!\n\nI'm **AIBot** — your personal AI assistant with adjustable parameters.\n\n**Try these:**\n• \`.ai hello\` — Start a conversation\n• \`.aimode sarcastic\` — Change my personality (friendly/professional/sarcastic/unhinged/philosopher)\n• \`.aiparam temperature 0.9\` — Adjust randomness (0.0–1.0)\n• \`.aistats\` — View my current parameters`, 'AIBot');
            } else if (channelId === 'general') {
                appendBotMessage(bot.getWelcomeMessage());
            } else {
                appendBotMessage(`👋 Welcome to **#${ch.name}**! ${ch.topic}`);
            }
        }

        scrollToBottom();
        chatInput.focus();
    }

    // ─── Render a stored message back to DOM ───────────────────────────────────
    function renderStoredMsg(msg) {
        switch (msg.type) {
            case 'user':   appendUserMessage(msg.text, msg.imageUrl, false, msg.timestamp, msg.author, msg.role); break;
            case 'bot':    appendBotMessage(msg.text, msg.botName, false, msg.timestamp); break;
            case 'ai':     appendAIMessage(msg.text, msg.timestamp, false); break;
            case 'embed':  if (msg.embedData) appendBotEmbed(msg.embedData, msg.botName, false, msg.timestamp); break;
            case 'system': appendBotMessage(msg.text, msg.botName || 'SystemBot', false, msg.timestamp); break;
            case 'announcement': appendAnnouncementMessage(msg.text, msg.author, false, msg.timestamp); break;
        }
    }

    // ─── Special Channel Banners ───────────────────────────────────────────────
    function appendAnnouncementBanner() {
        const el = document.createElement('div');
        el.className = 'announcement-banner';
        el.innerHTML = `
            <div class="announcement-header">
                <div class="announcement-header-glow"></div>
                <div class="announcement-logo"><i class="fas fa-bullhorn"></i></div>
                <div class="announcement-header-text">
                    <h2>📢 ${loadServers()[activeServerId]?.name || 'Gaming Central'} Announcements</h2>
                    <p>Official server news, updates, and important information</p>
                </div>
            </div>
            <div class="announcement-posts">
                <div class="announcement-post pinned">
                    <div class="announcement-pin"><i class="fas fa-thumbtack"></i> PINNED</div>
                    <div class="announcement-post-header">
                        <div class="avatar bot-avatar" style="width:36px;height:36px;background:var(--brand-color);font-size:16px;"><i class="fas fa-shield-alt"></i></div>
                        <span class="message-author role-admin">SystemBot <span class="bot-tag">BOT</span></span>
                        <span class="message-timestamp">Today</span>
                    </div>
                    <div class="announcement-post-content">
                        🎉 <strong>Welcome to ${escapeHTML(loadServers()[activeServerId]?.name || 'Gaming Central')}!</strong><br><br>
                        This is the official announcements channel. Only admins can post here.<br><br>
                        📌 <strong>Quick Links:</strong><br>
                        → #rules — Read the server rules<br>
                        → #general — Main chat channel<br>
                        → #ai-chat — Chat with AIBot 🤖<br>
                        → #casino — Gambling games<br>
                        → #bot-commands — Use bots here<br>
                        → #vip-lounge — VIP exclusive (buy VIP with .buy vip)<br><br>
                        💡 <em>Admins: Use .announce &lt;message&gt; to post here.</em>
                    </div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    function appendRulesBanner() {
        const el = document.createElement('div');
        el.className = 'rules-banner';
        el.innerHTML = `
            <div class="rules-header">
                <i class="fas fa-gavel"></i>
                <div>
                    <h2>📜 Server Rules</h2>
                    <p>Please read carefully. Breaking rules may result in moderation action.</p>
                </div>
            </div>
            <div class="rules-list">
                <div class="rule-item"><span class="rule-num">1</span><div><strong>Be Respectful</strong><p>Treat all members with respect. No harassment, hate speech, or bullying.</p></div></div>
                <div class="rule-item"><span class="rule-num">2</span><div><strong>No Spam</strong><p>Don't flood channels with repeated messages.</p></div></div>
                <div class="rule-item"><span class="rule-num">3</span><div><strong>Use Correct Channels</strong><p>Post content in the appropriate channel. Bot commands go in #bot-commands.</p></div></div>
                <div class="rule-item"><span class="rule-num">4</span><div><strong>No Advertising</strong><p>Don't advertise other servers or products without admin permission.</p></div></div>
                <div class="rule-item"><span class="rule-num">5</span><div><strong>Have Fun!</strong><p>This is a community. Enjoy the bots, earn points, and have a great time! 🎮</p></div></div>
            </div>
            <div class="rules-footer">
                <i class="fas fa-check-circle"></i> By being here, you agree to follow these rules.
                <span>Admins: .ban .kick .timeout .warn available</span>
            </div>
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    function appendVipBanner() {
        const el = document.createElement('div');
        el.className = 'vip-banner';
        el.innerHTML = `
            <div class="vip-banner-inner">
                <div class="vip-stars">⭐ ⭐ ⭐</div>
                <h2>Welcome to the VIP Lounge!</h2>
                <p>This exclusive channel is for VIP members and above. Enjoy your elite status! 👑</p>
                <div class="vip-perks">
                    <div class="vip-perk"><i class="fas fa-star"></i> Golden username</div>
                    <div class="vip-perk"><i class="fas fa-unlock"></i> Exclusive channel access</div>
                    <div class="vip-perk"><i class="fas fa-crown"></i> VIP badge in sidebar</div>
                    <div class="vip-perk"><i class="fas fa-gem"></i> Priority support</div>
                </div>
                <p class="vip-hint">Not VIP yet? Use <code>.buy vip</code> (costs $50 — use .convert to get dollars!)</p>
            </div>
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();
    }

    // ─── User UI ───────────────────────────────────────────────────────────────
    function getRoleClass(role) {
        if (role === 'Owner' || role === 'Admin') return 'role-admin';
        if (role === 'VIP') return 'role-vip';
        return 'role-member';
    }

    function updateUserUI() {
        const roleClass = getRoleClass(bot.role);
        currentUsernameEl.textContent = username;
        currentUsernameEl.className = `name ${roleClass}`;
        currentUserAvatar.textContent = username.charAt(0).toUpperCase();
        currentUserAvatar.style.backgroundColor = getAvatarColor(username);

        if (currentUserStatus) {
            const statusText = bot.isBanned ? '🚫 Banned' : bot.isTimedOut ? '⏰ Timed Out' : '🟢 Online';
            currentUserStatus.textContent = statusText;
        }

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

        const servers = loadServers();
        const sv = servers[activeServerId] || {};
        const serverHead = document.createElement('div');
        serverHead.className = 'members-server-header';
        serverHead.textContent = (sv.name || 'GAMING CENTRAL').toUpperCase();
        membersSidebar.appendChild(serverHead);

        const usersObj = bot.getUsersForSidebar();
        const categories = ['ADMIN', 'VIP', 'ONLINE'];
        let totalOnline = 0;

        const bots = [
            { name: 'CasinoBot',      icon: 'fa-robot',        color: 'var(--brand-color)', activity: '🎰 Spinning slots' },
            { name: 'EconomyBot',     icon: 'fa-coins',        color: '#2ecc71',            activity: '💰 Counting coins' },
            { name: 'TriviaBot',      icon: 'fa-brain',        color: '#f1c40f',            activity: '📚 Reading Wikipedia' },
            { name: 'FunBot',         icon: 'fa-laugh',        color: '#e67e22',            activity: '😂 Telling jokes' },
            { name: 'MusicBot',       icon: 'fa-music',        color: '#9b59b6',            activity: '🎵 Playing music' },
            { name: 'GiveawayBot',    icon: 'fa-gift',         color: '#e91e63',            activity: '🎁 Watching for .enter' },
            { name: 'ModerationBot',  icon: 'fa-shield-alt',   color: '#e74c3c',            activity: '🛡️ Keeping order' },
            { name: 'AIBot',          icon: 'fa-microchip',    color: '#00b0f4',            activity: `🧠 ${['Philosophizing','Hallucinating facts','Reasoning about stuff','Being sarcastic'][Math.floor(Math.random()*4)]}` }
        ];
        totalOnline += bots.length;

        categories.forEach(cat => {
            const list = usersObj[cat];
            if (cat !== 'ONLINE' && list.length === 0) return;
            totalOnline += list.length;
            const count = list.length + (cat === 'ONLINE' ? bots.length : 0);

            const catEl = document.createElement('div');
            catEl.className = 'members-category';
            const catLabel = cat === 'ADMIN' ? '👑 ADMINS' : cat === 'VIP' ? '⭐ VIP MEMBERS' : '🟢 ONLINE';
            catEl.textContent = `${catLabel} — ${count}`;
            membersSidebar.appendChild(catEl);

            if (cat === 'ONLINE') {
                bots.forEach(b => {
                    membersSidebar.insertAdjacentHTML('beforeend', `
                        <div class="member">
                            <div class="avatar bot-avatar" style="width:32px;height:32px;background:${b.color}">
                                <i class="fas ${b.icon}" style="font-size:13px"></i>
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
                const statusColor = u.banned ? '#e74c3c' : u.timedOut ? '#faa61a' : isSelf ? 'var(--online-color)' : 'var(--text-muted)';
                const statusTitle = u.banned ? '🚫 Banned' : u.timedOut ? '⏰ Timed Out' : isSelf ? 'Online' : 'Away';
                const avatarColor = getAvatarColor(u.name);
                membersSidebar.insertAdjacentHTML('beforeend', `
                    <div class="member ${u.banned ? 'member-banned' : ''}" title="${escapeHTML(u.name)} — ${u.role}${u.banned ? ' [BANNED]' : ''}">
                        <div class="avatar" style="width:32px;height:32px;background:${avatarColor}">
                            ${u.name.charAt(0).toUpperCase()}
                            <div class="status-indicator" style="background:${statusColor}" title="${statusTitle}"></div>
                        </div>
                        <div class="member-details">
                            <span class="name ${rClass}" style="font-size:13px;${u.banned?'text-decoration:line-through;opacity:0.5':''}">${escapeHTML(u.name)}</span>
                            <span class="activity">${isSelf ? 'Chilling 😎' : u.banned ? '🚫 Banned' : u.timedOut ? '⏰ Timed Out' : ''}</span>
                        </div>
                    </div>
                `);
            });
        });

        if (onlineMemberCount) onlineMemberCount.textContent = totalOnline;
    }

    // ─── Message Input ─────────────────────────────────────────────────────────
    chatInput.addEventListener('keypress', e => {
        if (e.key !== 'Enter') return;
        const text = chatInput.value.trim();
        if (!text) return;

        if (bot.isTimedOut) {
            const until = bot.db[username].timedOutUntil;
            const left = Math.ceil((until - Date.now()) / 1000);
            showToast(`⏰ You are timed out! ${left}s remaining.`, 'error');
            return;
        }
        if (bot.isBanned) { showToast('🚫 You are banned from this server!', 'error'); return; }
        if (bot.isMuted)  { showToast('🔇 You are muted!', 'error'); return; }

        if (!bot.checkChannelPermission(activeChannel)) {
            showToast(`🔒 You don't have permission to post in #${activeChannel}.`, 'error');
            return;
        }

        const sm = bot.slowmodeMap?.[activeChannel] || 0;
        if (sm > 0) {
            const now = Date.now();
            if (now - lastMsgTime < sm) {
                const wait = Math.ceil((sm - (now - lastMsgTime)) / 1000);
                showToast(`🐌 Slowmode: wait ${wait}s before sending another message.`, 'warning');
                return;
            }
            lastMsgTime = Date.now();
        }

        typingIndicator.style.display = 'none';
        clearTimeout(typingTimeout);
        appendUserMessage(text);
        chatInput.value = '';

        if (text.startsWith('.')) {
            const isAICmd = text.toLowerCase().startsWith('.ai ') || text.toLowerCase() === '.ai';
            const delay = isAICmd
                ? BOT_CONFIG.aiMinDelay + Math.random() * (BOT_CONFIG.aiMaxDelay - BOT_CONFIG.aiMinDelay)
                : 300 + Math.random() * 300;

            showBotTyping(isAICmd ? 'AIBot' : null);
            setTimeout(() => {
                hideBotTyping();
                handleBotResponse(bot.processCommand(text));
            }, delay);
        }
    });

    // ─── Bot Response Handler ──────────────────────────────────────────────────
    function handleBotResponse(response) {
        if (!response) return;
        const botName = response.botName || 'CasinoBot';

        if (response.type === 'text') {
            appendBotMessage(response.content, botName);
        } else if (response.type === 'ai_response') {
            appendAIMessage(response.content);
        } else if (response.type === 'embed') {
            appendBotEmbed(response, botName);
            if (response.extraText) appendBotMessage(response.extraText, botName);
        } else if (response.type === 'system') {
            if (response.content) {
                if (response.action === 'announce_post') {
                    appendAnnouncementMessage(response.content, response.author);
                } else if (response.action === 'giveaway_start') {
                    appendGiveawayMessage(response.content, response.duration, botName);
                } else if (response.action === 'giveaway_winner') {
                    appendBotMessage(response.content, botName || 'GiveawayBot');
                } else {
                    appendBotMessage(response.content, response.botName || 'SystemBot');
                }
            }
            if (response.action === 'update_roles') updateUserUI();
            else if (response.action === 'clear_chat') {
                messagesContainer.innerHTML = ''; allMessages = [];
                channelMsgStore[activeChannel] = [];
                saveMessages(activeServerId, activeChannel, []);
            } else if (response.action === 'update_channels') {
                renderChannels();
            } else if (response.action === 'slowmode') {
                bot.slowmodeMap = bot.slowmodeMap || {};
                bot.slowmodeMap[activeChannel] = response.value;
                if (response.value > 0) {
                    slowmodeBar.style.display = 'flex';
                    slowmodeSeconds.textContent = Math.ceil(response.value / 1000);
                } else {
                    slowmodeBar.style.display = 'none';
                }
            } else if (response.action === 'purge') {
                const toRemove = allMessages.slice(-response.count);
                toRemove.forEach(m => m.remove());
                allMessages = allMessages.slice(0, -response.count);
                if (channelMsgStore[activeChannel]) {
                    channelMsgStore[activeChannel] = channelMsgStore[activeChannel].slice(0, -response.count);
                    saveMessages(activeServerId, activeChannel, channelMsgStore[activeChannel]);
                }
            }
        }
    }

    // ─── Bot Typing ────────────────────────────────────────────────────────────
    let botTypingEl = null;
    function showBotTyping(specificBot = null) {
        botTypingEl = document.createElement('div');
        botTypingEl.className = 'bot-typing';
        const { icon, color } = specificBot ? getBotStyle(specificBot) : { icon: 'fa-robot', color: 'var(--brand-color)' };
        const name = specificBot || 'Bot';
        botTypingEl.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color}"><i class="fas ${icon}" style="font-size:18px"></i></div>
            <div class="typing-dots-wrap"><span class="typing-bot-name">${name}</span><div class="typing-dots"><span></span><span></span><span></span></div></div>
        `;
        messagesContainer.appendChild(botTypingEl);
        scrollToBottom();
    }
    function hideBotTyping() { if (botTypingEl) { botTypingEl.remove(); botTypingEl = null; } }

    // ─── Message Rendering ─────────────────────────────────────────────────────
    function appendUserMessage(text, imageDataUrl = null, persist = true, tsOverride = null, authorOverride = null, roleOverride = null) {
        const el = document.createElement('div');
        el.className = 'message fade-in';
        const roleClass = getRoleClass(roleOverride || bot.role);
        const avatarColor = getAvatarColor(authorOverride || username);
        const displayName = authorOverride || username;
        const ts = tsOverride || getTime();
        el.innerHTML = `
            <div class="avatar" style="width:40px;height:40px;flex-shrink:0;background:${avatarColor};font-size:18px">${escapeHTML(displayName.charAt(0).toUpperCase())}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author ${roleClass}">${escapeHTML(displayName)}</span>
                    <span class="message-timestamp">${ts}</span>
                </div>
                ${text ? `<div class="message-text">${parseMarkdown(escapeHTML(text))}</div>` : ''}
                ${imageDataUrl ? `<img src="${imageDataUrl}" class="message-image" alt="Uploaded image">` : ''}
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();

        if (persist) {
            storeMsg(activeChannel, {
                type: 'user', author: displayName, role: bot.role,
                text, imageUrl: imageDataUrl, timestamp: ts
            });
        }
    }

    function appendBotMessage(text, botName = 'CasinoBot', persist = true, tsOverride = null) {
        const { icon, color } = getBotStyle(botName);
        const el = document.createElement('div');
        el.className = 'message fade-in';
        const ts = tsOverride || getTime();
        el.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color};font-size:18px"><i class="fas ${icon}"></i></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color:${color}">${escapeHTML(botName)} <span class="bot-tag">BOT</span></span>
                    <span class="message-timestamp">${ts}</span>
                </div>
                <div class="message-text">${parseMarkdown(escapeHTML(text))}</div>
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();

        if (persist) {
            storeMsg(activeChannel, { type: 'bot', botName, text, timestamp: ts });
        }
    }

    function appendAIMessage(text, tsOverride = null, persist = true) {
        const el = document.createElement('div');
        el.className = 'message fade-in ai-message';
        const ts = tsOverride || getTime();
        el.innerHTML = `
            <div class="avatar bot-avatar ai-avatar" style="width:40px;height:40px;flex-shrink:0;font-size:18px">
                <i class="fas fa-microchip"></i>
                <div class="ai-pulse"></div>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author ai-name">AIBot <span class="bot-tag ai-tag">AI</span></span>
                    <span class="message-timestamp">${ts}</span>
                    <span class="ai-params-badge" title="Parameterized Response Engine">🌡️ ${bot.ai.temperature.toFixed(1)} 🎨 ${bot.ai.creativity.toFixed(1)} 🎭 ${bot.ai.personality}</span>
                </div>
                <div class="message-text ai-text">${parseMarkdown(escapeHTML(text))}</div>
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();

        if (persist) {
            storeMsg(activeChannel, { type: 'ai', text, timestamp: ts });
        }
    }

    function appendBotEmbed(embedObj, botName = 'CasinoBot', persist = true, tsOverride = null) {
        const { icon, color } = getBotStyle(botName);
        let embedClass = embedObj.color === 'win' ? 'win' : embedObj.color === 'lose' ? 'lose' : '';
        let fieldsHTML = (embedObj.fields || []).map(f => `
            <div class="embed-field">
                <div class="embed-field-name">${escapeHTML(f.name)}</div>
                <div class="embed-field-value">${parseMarkdown(escapeHTML(f.value))}</div>
            </div>
        `).join('');
        const el = document.createElement('div');
        el.className = 'message fade-in';
        const ts = tsOverride || getTime();
        el.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color};font-size:18px"><i class="fas ${icon}"></i></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color:${color}">${escapeHTML(botName)} <span class="bot-tag">BOT</span></span>
                    <span class="message-timestamp">${ts}</span>
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

        if (persist) {
            storeMsg(activeChannel, { type: 'embed', botName, embedData: embedObj, timestamp: ts });
        }
    }

    function appendAnnouncementMessage(text, author, persist = true, tsOverride = null) {
        const el = document.createElement('div');
        el.className = 'message announcement-msg fade-in';
        const avatarColor = getAvatarColor(author || username);
        const ts = tsOverride || getTime();
        el.innerHTML = `
            <div class="avatar" style="width:40px;height:40px;flex-shrink:0;background:${avatarColor};font-size:18px">${escapeHTML((author||username).charAt(0).toUpperCase())}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author role-admin">${escapeHTML(author||username)}</span>
                    <span class="announcement-tag">📢 ANNOUNCEMENT</span>
                    <span class="message-timestamp">${ts}</span>
                </div>
                <div class="message-text announcement-text">${parseMarkdown(escapeHTML(text))}</div>
            </div>
            ${getMessageToolbar()}
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();

        if (persist) {
            storeMsg(activeChannel, { type: 'announcement', author: author || username, text, timestamp: ts });
        }
    }

    function appendGiveawayMessage(text, duration, botName = 'GiveawayBot') {
        const { icon, color } = getBotStyle(botName);
        const el = document.createElement('div');
        el.className = 'message fade-in';
        const giveawayId = 'gw_' + Date.now();
        el.innerHTML = `
            <div class="avatar bot-avatar" style="width:40px;height:40px;flex-shrink:0;background:${color};font-size:18px"><i class="fas ${icon}"></i></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color:${color}">${escapeHTML(botName)} <span class="bot-tag">BOT</span></span>
                    <span class="message-timestamp">${getTime()}</span>
                </div>
                <div class="giveaway-card">
                    <div class="giveaway-header"><i class="fas fa-gift"></i> GIVEAWAY</div>
                    <div class="giveaway-body">${parseMarkdown(escapeHTML(text))}</div>
                    <div class="giveaway-timer" id="${giveawayId}">⏱️ Ending in: <strong>${duration}s</strong></div>
                    <div class="giveaway-entrants" id="${giveawayId}_count">Entrants: 0</div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(el);
        allMessages.push(el);
        scrollToBottom();

        let remaining = duration;
        clearGiveawayTimer();
        giveawayTimer = setInterval(() => {
            remaining--;
            const timerEl = document.getElementById(giveawayId);
            const countEl = document.getElementById(giveawayId + '_count');
            if (timerEl) timerEl.innerHTML = `⏱️ Ending in: <strong>${remaining}s</strong>`;
            if (countEl) countEl.textContent = `Entrants: ${bot.giveawayEntrants.length}`;
            if (remaining <= 0) {
                clearGiveawayTimer();
                if (timerEl) timerEl.innerHTML = `⏱️ <strong>ENDED!</strong>`;
                const result = bot.endGiveaway();
                if (result) handleBotResponse(result);
            }
        }, 1000);
    }

    function clearGiveawayTimer() {
        if (giveawayTimer) { clearInterval(giveawayTimer); giveawayTimer = null; }
    }

    // ─── Bot Styles ────────────────────────────────────────────────────────────
    function getBotStyle(name) {
        const styles = {
            'CasinoBot':     { icon: 'fa-robot',       color: 'var(--brand-color)' },
            'TriviaBot':     { icon: 'fa-brain',        color: '#f1c40f' },
            'EconomyBot':    { icon: 'fa-coins',        color: '#2ecc71' },
            'SystemBot':     { icon: 'fa-shield-alt',   color: '#e91e63' },
            'FunBot':        { icon: 'fa-laugh',        color: '#e67e22' },
            'MusicBot':      { icon: 'fa-music',        color: '#9b59b6' },
            'GiveawayBot':   { icon: 'fa-gift',         color: '#e91e63' },
            'ModerationBot': { icon: 'fa-gavel',        color: '#e74c3c' },
            'AIBot':         { icon: 'fa-microchip',    color: '#00b0f4' }
        };
        return styles[name] || { icon: 'fa-robot', color: 'var(--brand-color)' };
    }

    // ─── Message Toolbar ───────────────────────────────────────────────────────
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

    // ─── Reactions ─────────────────────────────────────────────────────────────
    window.addReaction = function(btn) {
        const quickEmojis = ['👍','❤️','😂','😮','😢','🔥','💯','🎉','🎰','💎'];
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

    // ─── Toasts ────────────────────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        toast.innerHTML = `<span>${icons[type]}</span> ${escapeHTML(message)}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('toast-hide'); setTimeout(() => toast.remove(), 400); }, 3200);
    }

    // ─── Utilities ─────────────────────────────────────────────────────────────
    function getTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function scrollToBottom() { messagesContainer.scrollTop = messagesContainer.scrollHeight; }
    function escapeHTML(str) {
        if (typeof str !== 'string') str = String(str ?? '');
        return str.replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
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
