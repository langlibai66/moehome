/**
 * MoeWah Editor — Visual Configuration Editor v3
 * Uses parseFullConfig (brace matching + safe eval) — no regex
 */

// ============================================================
// FULL CONFIG PARSER — parse the entire HOMEPAGE_CONFIG object
// ============================================================
function parseFullConfig(raw) {
    const marker = 'window.HOMEPAGE_CONFIG = ';
    const idx = raw.indexOf(marker);
    if (idx === -1) return {};
    const braceStart = raw.indexOf('{', idx);
    if (braceStart === -1) return {};

    // String-aware brace matching
    let depth = 0, endIdx = -1;
    let inStr = false, strCh = '';
    for (let i = braceStart; i < raw.length; i++) {
        const ch = raw[i];
        if (!inStr) {
            if (ch === '"' || ch === "'" || ch === '`') {
                inStr = true;
                strCh = ch;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) { endIdx = i; break; }
            }
        } else {
            if (ch === strCh && raw[i - 1] !== '\\') {
                inStr = false;
                strCh = '';
            }
        }
    }
    if (endIdx === -1) return {};

    try {
        return new Function('return ' + raw.substring(braceStart, endIdx + 1))();
    } catch (e) {
        console.error('Config parse error:', e.message);
        return {};
    }
}

// ============================================================
// CONFIG WRITER — parse → merge → serialize (no regex replace)
// ============================================================
function buildConfigSource() {
    const original = parseFullConfig(rawConfig);
    mergeConfig(original, cfg);
    return serializeConfig(original);
}

function mergeConfig(target, source) {
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            mergeConfig(target[key], value);
        } else if (Array.isArray(value)) {
            target[key] = [...value];
        } else if (value !== undefined && value !== null && value !== '') {
            target[key] = value;
        }
    }
}

function serializeConfig(obj) {
    const lines = [];
    lines.push('/**');
    lines.push(' * MoeWah Homepage Configuration');
    lines.push(' * 所有可配置内容集中管理，便于维护和更新');
    lines.push(' */');
    lines.push('');
    lines.push('window.HOMEPAGE_CONFIG = ' + serializeValue(obj, 1) + ';');
    lines.push('');
    lines.push('function formatIdentity() { return window.HOMEPAGE_CONFIG.identity.join(" / "); }');
    lines.push('function formatInterests() { return window.HOMEPAGE_CONFIG.interests.join(" / "); }');
    return lines.join('\n');
}

function serializeValue(val, indent) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';

    if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        const items = val.map(item => '    '.repeat(indent) + serializeValue(item, indent + 1));
        return '[\n' + items.join(',\n') + '\n' + '    '.repeat(indent - 1) + ']';
    }

    if (typeof val === 'object') {
        const entries = Object.entries(val);
        if (entries.length === 0) return '{}';
        const pairs = entries.map(([k, v]) =>
            '    '.repeat(indent) + k + ': ' + serializeValue(v, indent + 1)
        );
        return '{\n' + pairs.join(',\n') + '\n' + '    '.repeat(indent - 1) + '}';
    }

    return String(val);
}

// ============================================================
// STATE
// ============================================================
let rawConfig = '';
let cfg = {};
let saveTimer = null;

const $ = id => document.getElementById(id);

// ============================================================
// INIT — load config using parseFullConfig
// ============================================================
async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        rawConfig = data.content;
        cfg = parseFullConfig(rawConfig);
        renderCards();
        showStatus('ready');
    } catch (e) {
        showToast('加载配置失败: ' + e.message, 'error');
    }
}

/**
 * Convert full HOMEPAGE_CONFIG into editor cfg
 * Keys match the actual nested config structure so mergeConfig
 * produces correct output.
 */
function buildEditorConfig(full) {
    return {
        site: {
            name: full?.site?.name || '',
            tagline: full?.site?.tagline || '',
            url: full?.site?.url || '',
        },
        profile: {
            name: full?.profile?.name || '',
            taglinePrefix: full?.profile?.tagline?.prefix || '',
            taglineHighlight: full?.profile?.tagline?.highlight || '',
        },
        identity: [...(full?.identity || [])],
        interests: [...(full?.interests || [])],
        terminal: {
            title: full?.terminal?.title || '',
        },
        quotes: [...(full?.quotes || [])],
        theme: {
            default: full?.theme?.default || 'auto',
            defaultScheme: {
                light: full?.theme?.defaultScheme?.light || '',
                dark: full?.theme?.defaultScheme?.dark || '',
            },
        },
        projects: {
            enabled: full?.projects?.enabled ?? true,
            title: {
                text: full?.projects?.title?.text || '',
            },
            githubUser: full?.projects?.githubUser || '',
            count: full?.projects?.count || 6,
        },
        contribution: {
            enabled: full?.contribution?.enabled ?? true,
            useRealData: full?.contribution?.useRealData ?? true,
        },
        rss: {
            enabled: full?.rss?.enabled ?? false,
            url: full?.rss?.url || '',
        },
        linksConfig: {
            enabled: full?.linksConfig?.enabled ?? true,
            title: {
                text: full?.linksConfig?.title?.text || '',
            },
        },
        links: (full?.links || []).map(l => ({ ...l })),
        notice: {
            enabled: full?.notice?.enabled ?? false,
            text: full?.notice?.text || '',
        },
        footer: {
            copyright: {
                year: full?.footer?.copyright?.year || '',
                name: full?.footer?.copyright?.name || '',
            },
        },
        analytics: {
            googleAnalytics: {
                enabled: full?.analytics?.googleAnalytics?.enabled ?? false,
                id: full?.analytics?.googleAnalytics?.id || '',
            },
        },
        nav: {
            enabled: full?.nav?.enabled ?? false,
        },
    };
}

// ============================================================
// VALUE HELPERS
// ============================================================
function getVal(keyPath) {
    const parts = keyPath.split('.');
    let obj = cfg;
    for (const p of parts) { obj = obj?.[p]; }
    return obj ?? '';
}

function setVal(keyPath, value) {
    const parts = keyPath.split('.');
    let obj = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    debouncedSave();
}

// ============================================================
// CARD DEFINITIONS
// ============================================================
const CARD_DEFS = [
    {
        id: 'site', icon: 'fa-globe', color: '#4a9eff',
        title: '站点基础',
        fields: [
            { label: '站点名称', key: 'site.name', type: 'text', placeholder: '杨晨旭' },
            { label: '站点标语', key: 'site.tagline', type: 'text', placeholder: '开发者 / 技术爱好者' },
            { label: '站点 URL', key: 'site.url', type: 'text', placeholder: 'https://example.com' },
        ]
    },
    {
        id: 'profile', icon: 'fa-user', color: '#b066ff',
        title: '个人资料',
        fields: [
            { label: '显示名称', key: 'profile.name', type: 'text' },
            { label: '个性签名前缀', key: 'profile.tagline.prefix', type: 'text', placeholder: '🐱' },
            { label: '个性签名高亮', key: 'profile.tagline.highlight', type: 'text', placeholder: '欢迎来到我的主页' },
        ],
        sections: [
            { label: '头像', itemsKey: '__avatar__', isAvatar: true },
        ]
    },
    {
        id: 'identity', icon: 'fa-fingerprint', color: '#ff4d6a',
        title: '身份标签 & 兴趣',
        sections: [
            { label: '身份标签', itemsKey: 'identity' },
            { label: '兴趣领域', itemsKey: 'interests' },
        ]
    },
    {
        id: 'terminal', icon: 'fa-terminal', color: '#27c93f',
        title: '终端 & 语录',
        fields: [
            { label: '终端标题', key: 'terminal.title', type: 'text', placeholder: '🐱 user@host:~|' },
        ],
        sections: [
            { label: '名人语录', itemsKey: 'quotes' },
        ]
    },
    {
        id: 'theme', icon: 'fa-palette', color: '#ff9500',
        title: '主题配色',
        fields: [
            { label: '默认模式', key: 'theme.default', type: 'select', options: [
                { v: 'auto', l: '跟随系统' }, { v: 'light', l: '浅色' }, { v: 'dark', l: '暗色' }
            ]},
            { label: '浅色配色方案', key: 'theme.defaultScheme.light', type: 'text', placeholder: 'coralOrange' },
            { label: '暗色配色方案', key: 'theme.defaultScheme.dark', type: 'text', placeholder: 'catppuccinMocha' },
        ]
    },
    {
        id: 'links', icon: 'fa-link', color: '#00a1ff',
        title: '链接导航',
        toggle: { label: '启用链接模块', key: 'linksConfig.enabled', get: () => cfg.linksConfig?.enabled ?? true },
        fields: [
            { label: '模块标题', key: 'linksConfig.title.text', type: 'text', placeholder: '链接导航' },
        ],
        sections: [
            { label: '链接列表', itemsKey: 'links', isLinks: true },
        ],
        addButton: { label: '添加链接', action: 'addLink' },
    },
    {
        id: 'projects', icon: 'fa-folder-open', color: '#ff9500',
        title: 'GitHub 项目',
        fields: [
            { label: '启用项目展示', key: 'projects.enabled', type: 'toggle', get: () => cfg.projects?.enabled ?? true },
            { label: '板块标题', key: 'projects.title.text', type: 'text', placeholder: '我的项目' },
            { label: 'GitHub 用户名', key: 'projects.githubUser', type: 'text', placeholder: 'yourusername' },
            { label: '显示数量', key: 'projects.count', type: 'number', min: 1, max: 12 },
        ]
    },
    {
        id: 'contribution', icon: 'fa-chart-bar', color: '#9b59b6',
        title: '贡献图',
        fields: [
            { label: '启用贡献图', key: 'contribution.enabled', type: 'toggle', get: () => cfg.contribution?.enabled ?? true },
            { label: '使用真实数据', key: 'contribution.useRealData', type: 'toggle', get: () => cfg.contribution?.useRealData ?? true },
        ]
    },
    {
        id: 'notice', icon: 'fa-shield-halved', color: '#ff3b3b',
        title: '安全提示',
        fields: [
            { label: '启用提示', key: 'notice.enabled', type: 'toggle', get: () => cfg.notice?.enabled ?? false },
            { label: '提示内容', key: 'notice.text', type: 'text', placeholder: '输入提示内容...' },
        ]
    },
    {
        id: 'footer', icon: 'fa-shoe-prints', color: '#5c7cfa',
        title: '页脚',
        fields: [
            { label: '版权年份', key: 'footer.copyright.year', type: 'text' },
            { label: '版权名称', key: 'footer.copyright.name', type: 'text' },
        ]
    },
    {
        id: 'analytics', icon: 'fa-chart-line', color: '#e4a853',
        title: '统计分析',
        fields: [
            { label: 'Google Analytics', key: 'analytics.googleAnalytics.enabled', type: 'toggle', get: () => cfg.analytics?.googleAnalytics?.enabled ?? false },
            { label: 'GA ID', key: 'analytics.googleAnalytics.id', type: 'text', placeholder: 'G-XXXXXXXXXX' },
        ]
    },
];

// ============================================================
// RENDER CARDS
// ============================================================
function renderCards() {
    const container = $('cards-container');
    container.innerHTML = '';
    for (const def of CARD_DEFS) {
        container.appendChild(createCard(def));
    }
}

function createCard(def) {
    const el = document.createElement('div');
    el.className = 'config-card';
    el.dataset.id = def.id;

    const badge = def.sections?.some(s => s.isLinks)
        ? `${(cfg.links || []).length} 条`
        : def.id;

    let bodyHTML = '';

    if (def.toggle) {
        const val = def.toggle.get ? def.toggle.get() : getVal(def.toggle.key);
        bodyHTML += toggleHTML(def.toggle.label, def.toggle.key, val);
    }

    if (def.fields) {
        for (const f of def.fields) {
            if (f.type === 'toggle') {
                const val = f.get ? f.get() : getVal(f.key);
                bodyHTML += toggleHTML(f.label, f.key, val);
            } else if (f.type === 'select') {
                bodyHTML += selectHTML(f.label, f.key, getVal(f.key), f.options);
            } else if (f.type === 'number') {
                bodyHTML += numberHTML(f.label, f.key, getVal(f.key), f);
            } else {
                bodyHTML += textHTML(f.label, f.key, getVal(f.key), f);
            }
        }
    }

    if (def.sections) {
        for (const sec of def.sections) {
            bodyHTML += arraySectionHTML(sec);
        }
    }

    if (def.addButton) {
        bodyHTML += addButtonHTML(def.addButton);
    }

    el.innerHTML = `
        <div class="card-header" data-toggle="${def.id}">
            <div class="card-header-left">
                <div class="card-icon" style="background:${def.color}18;color:${def.color}">
                    <i class="fa-solid ${def.icon}"></i>
                </div>
                <span class="card-title">${def.title}</span>
                <span class="card-badge">${badge}</span>
            </div>
            <i class="fa-solid fa-chevron-down card-toggle"></i>
        </div>
        <div class="card-body">${bodyHTML}</div>
    `;

    el.querySelector('.card-header').addEventListener('click', () => {
        el.classList.toggle('collapsed');
    });

    bindCardEvents(el);
    return el;
}

// ============================================================
// FIELD HTML BUILDERS
// ============================================================
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textHTML(label, key, value, opts) {
    const inputType = key === 'site.url' || key.endsWith('.url') ? 'url' : 'text';
    return `<div class="field-group">
        <label class="field-label">${esc(label)}</label>
        <input type="${inputType}" data-key="${key}" value="${esc(value)}" placeholder="${esc(opts?.placeholder || '')}" ${opts?.mono ? 'style="font-family:var(--font-mono);font-size:12px"' : ''}>
    </div>`;
}

function numberHTML(label, key, value, opts) {
    return `<div class="field-group">
        <label class="field-label">${esc(label)}</label>
        <input type="number" data-key="${key}" value="${value}" ${opts.min ? 'min="'+opts.min+'"' : ''} ${opts.max ? 'max="'+opts.max+'"' : ''}>
    </div>`;
}

function selectHTML(label, key, value, options) {
    const opts = options.map(o =>
        `<option value="${o.v}" ${o.v === value ? 'selected' : ''}>${o.l}</option>`
    ).join('');
    return `<div class="field-group">
        <label class="field-label">${esc(label)}</label>
        <select data-key="${key}"><option value="">-- 选择 --</option>${opts}</select>
    </div>`;
}

function toggleHTML(label, key, value) {
    return `<div class="field-group">
        <div class="toggle-wrap">
            <div class="toggle ${value ? 'on' : ''}" data-key="${key}" data-toggle></div>
            <span class="toggle-label">${esc(label)}</span>
        </div>
    </div>`;
}

function arraySectionHTML(sec) {
    const itemsKey = sec.itemsKey;
    const items = cfg[itemsKey] || [];

    // Special avatar upload section
    if (sec.isAvatar) {
        const avatarPath = cfg.profile?.avatar || 'images/avatar.webp';
        return `<div class="field-group">
            <label class="field-label">${esc(sec.label)}</label>
            <div class="avatar-upload" id="avatar-upload">
                <div class="avatar-preview" id="avatar-preview">
                    <img id="avatar-preview-img" src="${esc(avatarPath)}" alt="Avatar preview" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%%22 x=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2240%22>📷</text></svg>'">
                </div>
                <div class="avatar-actions">
                    <label class="btn-add" style="width:auto;padding:6px 14px;cursor:pointer">
                        <i class="fa-solid fa-upload"></i> 选择图片
                        <input type="file" accept="image/*" id="avatar-file-input" style="display:none">
                    </label>
                    <span class="avatar-hint" id="avatar-hint">支持 JPG、PNG、WebP</span>
                </div>
            </div>
        </div>`;
    }

    let itemsHTML = '';
    if (sec.isLinks) {
        items.forEach((link, i) => { itemsHTML += linkItemHTML(i, link); });
    } else {
        items.forEach((val, i) => {
            itemsHTML += `<div class="array-item">
                <span class="array-idx">${i}</span>
                <input type="text" data-array="${itemsKey}" data-idx="${i}" value="${esc(val)}">
                <button class="btn-icon btn-icon-danger" data-remove="${itemsKey}:${i}" title="删除">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;
        });
    }

    return `<div class="field-group">
        <label class="field-label">${esc(sec.label)} (${items.length})</label>
        <div class="array-list" data-array-key="${itemsKey}">${itemsHTML}</div>
    </div>`;
}

function linkItemHTML(index, link) {
    return `<div class="link-card" data-link-idx="${index}">
        <div class="link-card-header">
            <span class="link-card-title">
                <i class="${link.icon || 'fa-solid fa-link'}" style="color:${link.color || '#00ff9f'};margin-right:6px"></i>
                ${esc(link.name || '未命名')}
            </span>
            <button class="btn-icon btn-icon-danger" data-remove-link="${index}" title="删除链接">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
        <div class="link-card-grid">
            <div class="field-group">
                <label class="field-label">名称</label>
                <input type="text" data-link="${index}:name" value="${esc(link.name || '')}">
            </div>
            <div class="field-group">
                <label class="field-label">图标 (FontAwesome)</label>
                <input type="text" data-link="${index}:icon" value="${esc(link.icon || '')}" placeholder="fa-solid fa-link">
            </div>
            <div class="field-group full-width">
                <label class="field-label">URL</label>
                <input type="text" data-link="${index}:url" value="${esc(link.url || '')}" placeholder="https://...">
            </div>
            <div class="field-group">
                <label class="field-label">描述</label>
                <input type="text" data-link="${index}:description" value="${esc(link.description || '')}">
            </div>
            <div class="field-group">
                <label class="field-label">颜色</label>
                <div class="color-wrap">
                    <input type="color" data-link-color="${index}" value="${link.color || '#00ff9f'}">
                    <input type="text" data-link="${index}:color" value="${esc(link.color || '#00ff9f')}">
                </div>
            </div>
        </div>
        <div class="link-card-toggles">
            <div class="toggle-wrap">
                <div class="toggle ${link.enabled !== false ? 'on' : ''}" data-link-toggle="${index}:enabled"></div>
                <span class="toggle-label">启用</span>
            </div>
            <div class="toggle-wrap">
                <div class="toggle ${link.antiCrawler ? 'on' : ''}" data-link-toggle="${index}:antiCrawler"></div>
                <span class="toggle-label">邮箱反爬</span>
            </div>
        </div>
    </div>`;
}

function addButtonHTML(opts) {
    return `<button class="btn-add" id="btn-add-link"><i class="fa-solid fa-plus"></i> ${esc(opts.label)}</button>`;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindCardEvents(cardEl) {
    cardEl.querySelectorAll('input[data-key]').forEach(input => {
        input.addEventListener('input', () => setVal(input.dataset.key, input.value));
    });

    cardEl.querySelectorAll('select[data-key]').forEach(sel => {
        sel.addEventListener('change', () => setVal(sel.dataset.key, sel.value));
    });

    cardEl.querySelectorAll('[data-toggle]').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.toggle('on');
            setVal(toggle.dataset.key, toggle.classList.contains('on'));
        });
    });

    cardEl.querySelectorAll('input[data-array]').forEach(input => {
        input.addEventListener('input', () => {
            const key = input.dataset.array;
            const idx = parseInt(input.dataset.idx);
            if (cfg[key]) { cfg[key][idx] = input.value; debouncedSave(); }
        });
    });

    cardEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const [key, idx] = btn.dataset.remove.split(':');
            if (cfg[key]) { cfg[key].splice(parseInt(idx), 1); renderCards(); debouncedSave(); }
        });
    });

    cardEl.querySelectorAll('input[data-link]').forEach(input => {
        input.addEventListener('input', () => {
            const [idx, field] = input.dataset.link.split(':');
            const link = cfg.links && cfg.links[parseInt(idx)];
            if (link) { link[field] = input.value; debouncedSave(); }
        });
    });

    cardEl.querySelectorAll('input[data-link-color]').forEach(picker => {
        picker.addEventListener('input', () => {
            const idx = parseInt(picker.dataset.linkColor);
            const textInput = cardEl.querySelector(`input[data-link="${idx}:color"]`);
            if (textInput) textInput.value = picker.value;
            if (cfg.links && cfg.links[idx]) { cfg.links[idx].color = picker.value; debouncedSave(); }
        });
    });

    cardEl.querySelectorAll('[data-link-toggle]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('on');
            const [idx, field] = toggle.dataset.linkToggle.split(':');
            if (cfg.links && cfg.links[parseInt(idx)]) {
                cfg.links[parseInt(idx)][field] = toggle.classList.contains('on');
                debouncedSave();
            }
        });
    });

    cardEl.querySelectorAll('[data-remove-link]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.removeLink);
            if (cfg.links) { cfg.links.splice(idx, 1); renderCards(); debouncedSave(); }
        });
    });

    const addBtn = cardEl.querySelector('#btn-add-link');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (!cfg.links) cfg.links = [];
            cfg.links.push({
                name: '新链接', description: '描述', url: 'https://',
                icon: 'fa-solid fa-link', brand: 'link', color: '#00ff9f',
                external: true, enabled: true, antiCrawler: false,
            });
            renderCards();
            debouncedSave();
        });
    }

    // Avatar upload
    const avatarInput = cardEl.querySelector('#avatar-file-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('请选择图片文件', 'error');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast('图片不能超过 5MB', 'error');
                return;
            }

            const reader = new FileReader();
            const hint = cardEl.querySelector('#avatar-hint');
            if (hint) hint.textContent = '上传中...';

            reader.onload = async (ev) => {
                try {
                    const res = await fetch('/api/upload-avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dataUrl: ev.target.result }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        // Update config
                        cfg.profile = cfg.profile || {};
                        cfg.profile.avatar = data.path;
                        debouncedSave();

                        // Update preview
                        const previewImg = cardEl.querySelector('#avatar-preview-img');
                        if (previewImg) previewImg.src = ev.target.result;
                        if (hint) hint.textContent = '上传成功';
                        showToast('头像上传成功', 'success');
                    } else {
                        throw new Error(data.error);
                    }
                } catch (err) {
                    if (hint) hint.textContent = '上传失败';
                    showToast('头像上传失败: ' + err.message, 'error');
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

// ============================================================
// SAVE
// ============================================================
function debouncedSave() {
    clearTimeout(saveTimer);
    showStatus('saving');
    saveTimer = setTimeout(saveConfig, 600);
}

async function saveConfig() {
    try {
        rawConfig = buildConfigSource();
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: rawConfig }),
        });
        if (res.ok) {
            showStatus('saved');
        } else {
            throw new Error('Save failed');
        }
    } catch (e) {
        showStatus('error');
        showToast('保存失败: ' + e.message, 'error');
    }
}

// ============================================================
// STATUS & TOAST
// ============================================================
function showStatus(status) {
    const el = $('save-status');
    el.classList.add('show');
    if (status === 'saving') {
        el.className = 'save-status show';
        el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
    } else if (status === 'saved') {
        el.className = 'save-status show';
        el.innerHTML = '<i class="fa-solid fa-circle-check"></i> 已保存';
        setTimeout(() => el.classList.remove('show'), 2500);
    } else if (status === 'error') {
        el.className = 'save-status show error';
        el.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> 保存失败';
    } else {
        el.className = 'save-status show';
        el.innerHTML = '<i class="fa-solid fa-circle-check"></i> 就绪';
        setTimeout(() => el.classList.remove('show'), 2000);
    }
}

function showToast(msg, type) {
    const icons = { success: 'fa-check', error: 'fa-xmark', info: 'fa-info', warning: 'fa-triangle-exclamation' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${esc(msg)}`;
    $('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// BUILD & PUBLISH
// ============================================================
async function doBuild() {
    showToast('正在构建...', 'info');
    try {
        const res = await fetch('/api/build', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const previewUrl = `${window.location.origin}/`;
            $('preview-url').textContent = previewUrl;
            $('preview-placeholder').classList.add('hidden');
            const wrap = $('preview-frame-wrap');
            wrap.classList.remove('hidden');
            $('preview-iframe').src = previewUrl;
            showToast('构建完成', 'success');
        } else {
            showToast('构建失败', 'error');
        }
    } catch (e) {
        showToast('构建请求失败', 'error');
    }
}

function openPreviewInNewTab() {
    window.open('/', '_blank');
}

async function doPublish() {
    const overlay = $('modal-overlay');
    const title = $('modal-title');
    const body = $('modal-body');

    title.textContent = '发布中...';
    body.innerHTML = `<div class="modal-spinner"><div class="spinner"></div><span>正在构建并推送到 GitHub...</span></div>`;
    overlay.classList.add('active');

    try {
        const res = await fetch('/api/publish', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            title.textContent = '发布成功';
            body.innerHTML = `
                <div style="text-align:center;padding:8px 0">
                    <i class="fa-solid fa-check" style="font-size:36px;color:var(--success);display:block;margin-bottom:10px"></i>
                    <p style="color:var(--text-secondary);margin-bottom:14px">已成功推送到 GitHub</p>
                </div>
                <div class="modal-output">${esc(data.output)}</div>
                <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>`;
        } else {
            title.textContent = '发布失败';
            body.innerHTML = `
                <div style="text-align:center;padding:8px 0">
                    <i class="fa-solid fa-xmark" style="font-size:36px;color:var(--error);display:block;margin-bottom:10px"></i>
                    <p style="color:var(--text-secondary);margin-bottom:14px">发布出错</p>
                </div>
                <div class="modal-output">${esc(data.error || '未知错误')}</div>
                <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>`;
        }
    } catch (e) {
        title.textContent = '发布失败';
        body.innerHTML = `<div class="modal-output">${esc(e.message)}</div>
            <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>`;
    }
}

function closeModal() { $('modal-overlay').classList.remove('active'); }

// ============================================================
// PREVIEW TABS
// ============================================================
function switchTab(view) {
    document.querySelectorAll('.preview-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === view);
    });
    const iframe = $('preview-iframe');
    const source = $('config-source');
    if (view === 'preview') {
        iframe.classList.remove('hidden');
        source.classList.add('hidden');
        source.classList.remove('visible');
    } else {
        iframe.classList.add('hidden');
        source.classList.remove('hidden');
        source.classList.add('visible');
        $('config-code').textContent = rawConfig;
    }
}

// ============================================================
// GLOBAL EVENTS
// ============================================================
function setupEvents() {
    $('cards-container').addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const card = toggle.closest('.config-card');
            card.classList.toggle('collapsed');
        }
    });

    $('btn-build').addEventListener('click', doBuild);
    $('btn-publish').addEventListener('click', doPublish);
    $('btn-refresh-preview').addEventListener('click', () => { $('preview-iframe').src = $('preview-iframe').src; });
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });

    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.view));
    });

    $('btn-collapse-all').addEventListener('click', () => {
        document.querySelectorAll('.config-card').forEach(c => c.classList.add('collapsed'));
    });
    $('btn-expand-all').addEventListener('click', () => {
        document.querySelectorAll('.config-card').forEach(c => c.classList.remove('collapsed'));
    });

    const btnOpenNewTab = $('btn-open-new-tab');
    if (btnOpenNewTab) btnOpenNewTab.addEventListener('click', openPreviewInNewTab);

    const btnClosePreview = $('btn-close-preview');
    if (btnClosePreview) {
        btnClosePreview.addEventListener('click', () => {
            $('preview-placeholder').classList.remove('hidden');
            $('preview-frame-wrap').classList.add('hidden');
            $('preview-iframe').src = 'about:blank';
        });
    }

    setupResizer();

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveConfig(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doPublish(); }
    });
}

// ============================================================
// PANEL RESIZER
// ============================================================
function setupResizer() {
    const resizer = $('panel-resizer');
    const panel = $('cards-panel');
    let startX, startW;
    resizer.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startW = panel.offsetWidth;
        resizer.classList.add('active');
        document.body.style.cssText = 'cursor:col-resize;user-select:none';
        const onMove = (e) => {
            const w = Math.max(320, Math.min(620, startW + e.clientX - startX));
            panel.style.width = w + 'px';
        };
        const onUp = () => {
            resizer.classList.remove('active');
            document.body.style.cssText = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ============================================================
// START
// ============================================================
init().then(setupEvents);
