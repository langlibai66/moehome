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
// CONFIG WRITER — serialize directly from cfg object
// ============================================================
// (serializeConfig is defined below in the serialization section)

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
let serverDead = false;   // 编辑器服务是否已停止（连接失败时置位）

const $ = id => document.getElementById(id);

// ============================================================
// API FETCH WRAPPER — 检测服务是否停止，停止时显示常驻横幅
// ============================================================
async function apiFetch(url, opts) {
    try {
        const res = await fetch(url, opts);
        if (serverDead) hideServerBanner();
        return res;
    } catch (e) {
        showServerBanner();
        throw e;
    }
}

function showServerBanner() {
    serverDead = true;
    const b = $('server-banner');
    if (b) b.classList.remove('hidden');
}

function hideServerBanner() {
    serverDead = false;
    const b = $('server-banner');
    if (b) b.classList.add('hidden');
}

// ============================================================
// INIT — load config using parseFullConfig
// ============================================================
async function init() {
    try {
        const res = await apiFetch('/api/config');
        const data = await res.json();
        rawConfig = data.content;
        cfg = parseFullConfig(rawConfig);
        renderCards();
        loadPreviewInPane();   // 进入编辑器即把当前构建结果渲染到预览栏
        showStatus('ready');
    } catch (e) {
        // 服务挂了时横幅已给出指引，这里只在服务正常但加载失败时提示
        if (!serverDead) showToast('加载配置失败: ' + e.message, 'error');
    }
    // 会话检查点：进入编辑器时备份一次当前配置（服务端自动去重，内容相同则跳过）
    apiFetch('/api/backup', { method: 'POST' }).catch(() => {});
}

// (buildEditorConfig 已移除：init() 直接用 parseFullConfig 载入完整 HOMEPAGE_CONFIG，
//  无需中间转换层，避免与真实配置结构脱节)

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
        title: '站点域名',
        // 站点“名称/标语”实际由「站点名称与标语」卡（profile.name / profile.tagline）渲染，
        // 这里只保留会影响构建产物资源路径的 site.url，避免误导用户编辑不生效的字段。
        fields: [
            { label: '站点域名 (URL)', key: 'site.url', type: 'text', placeholder: 'https://www.aaaieee.cn（留空=相对路径）' },
        ],
        hint: '留空则资源使用相对路径（推荐，无需改动）。一旦填写，构建会把所有资源改成绝对路径，必须含 https:// 完整域名，否则全站 CSS / 图片会 404 导致页面崩溃。',
    },
    {
        id: 'seo', icon: 'fa-magnifying-glass', color: '#00d4ff',
        title: 'SEO 与浏览器标题',
        fields: [
            { label: '浏览器标题（标签页显示）', key: 'seo.title', type: 'text', placeholder: '杨晨旭 - 个人主页' },
            { label: '页面描述（meta description）', key: 'seo.description', type: 'text', placeholder: '欢迎访问…（影响搜索结果摘要）' },
            { label: 'OG 标题（社交分享卡片）', key: 'seo.og.title', type: 'text', placeholder: '杨晨旭 - 个人主页' },
            { label: 'OG 描述', key: 'seo.og.description', type: 'text', placeholder: '开发者 / 技术爱好者' },
            { label: 'OG 图片（分享预览图）', key: 'seo.og.image', type: 'text', placeholder: '/images/avatar.jpg（留空用站点图）' },
        ],
        sections: [
            { label: '关键词（keywords）', itemsKey: 'seo.keywords' },
        ],
        hint: '浏览器标题 = 浏览器标签页显示的文字（<title>），默认只是「杨晨旭…」太单调，这里改完就生效。OG 字段决定分享到微信/微博/推特时的卡片。',
    },
    {
        id: 'profile', icon: 'fa-user', color: '#b066ff',
        title: '站点名称与标语',
        fields: [
            { label: '站点名称（首页大标题）', key: 'profile.name', type: 'text', placeholder: '你的名字' },
            { label: '标语前缀（emoji）', key: 'profile.tagline.prefix', type: 'text', placeholder: '🐱' },
            { label: '标语高亮', key: 'profile.tagline.highlight', type: 'text', placeholder: '欢迎来到我的主页' },
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
            { label: 'GitHub 主页 URL', key: 'projects.githubUser', type: 'text', placeholder: 'https://github.com/username' },
            { label: '显示数量', key: 'projects.count', type: 'number', min: 1, max: 12 },
        ]
    },
    {
        id: 'contribution', icon: 'fa-chart-bar', color: '#9b59b6',
        title: '贡献图',
        fields: [
            { label: '启用贡献图', key: 'contribution.enabled', type: 'toggle', get: () => cfg.contribution?.enabled ?? true },
            { label: 'GitHub 用户主页（贡献图真实数据来源）', key: 'contribution.githubUser', type: 'text', placeholder: 'https://github.com/username' },
            { label: '使用真实数据', key: 'contribution.useRealData', type: 'toggle', get: () => cfg.contribution?.useRealData ?? true },
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
// 计算卡片右上角徽标：链接卡显示条数，纯数组卡显示项数，
// 带开关的卡显示「已启用 / 已停用」，其余（站点/个人资料/主题/页脚）不显示徽标
function computeBadge(def) {
    if (def.sections?.some(s => s.isLinks)) {
        return `${(cfg.links || []).length} 条`;
    }
    const arraySecs = def.sections?.filter(s => !s.isLinks && !s.isAvatar);
    if (arraySecs && arraySecs.length) {
        const total = arraySecs.reduce((n, s) => n + (cfg[s.itemsKey] || []).length, 0);
        return `${total} 项`;
    }
    const toggleField = def.toggle || def.fields?.find(f => f.type === 'toggle');
    if (toggleField) {
        const on = toggleField.get ? toggleField.get() : getVal(toggleField.key);
        return on ? '已启用' : '已停用';
    }
    return '';
}

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

    const badge = computeBadge(def);

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
                ${badge ? `<span class="card-badge">${badge}</span>` : ''}
            </div>
            <i class="fa-solid fa-chevron-down card-toggle"></i>
        </div>
        <div class="card-body">${bodyHTML}${def.hint ? `<p class="card-hint">${esc(def.hint)}</p>` : ''}</div>
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
        const rawAvatar = cfg.profile?.avatar || 'images/avatar.webp';
        // 编辑器页在 /editor 下，相对路径会解析到 /editor/images/... 导致 404，统一转绝对路径
        const avatarPath = rawAvatar.startsWith('/') ? rawAvatar : '/' + rawAvatar;
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
        ${(!sec.isLinks && !sec.isAvatar) ? `<button class="btn-add" data-add-plain="${itemsKey}"><i class="fa-solid fa-plus"></i> 添加</button>` : ''}
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
        input.addEventListener('input', () => {
            // 数字字段存为 Number 而非字符串，保持配置类型正确
            let v = input.value;
            if (input.type === 'number') v = v === '' ? '' : Number(v);
            setVal(input.dataset.key, v);
        });
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

    // 普通数组（身份/兴趣/语录/关键词…）的通用「添加」按钮
    cardEl.querySelectorAll('[data-add-plain]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.dataset.addPlain;
            if (!cfg[key]) cfg[key] = [];
            cfg[key].push('');
            renderCards();
            debouncedSave();
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
                    const res = await apiFetch('/api/upload-avatar', {
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
    // 注意：不再在每次保存时备份（会刷爆备份槽位）。
    // 备份时机 = 打开编辑器时的会话检查点 + 恢复/重置前 + 手动创建备份。
    try {
        rawConfig = serializeConfig(cfg);
        const res = await apiFetch('/api/config', {
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
        // 服务停止时横幅已说明情况，不再弹重复 toast
        if (!serverDead) showToast('保存失败: ' + e.message, 'error');
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
// 强制保存：清空 debounce 定时器，立即落盘
// 发布/构建前必须调用，否则读到的还是旧配置
async function flushSave() {
    clearTimeout(saveTimer);
    await saveConfig();
}

async function doBuild() {
    showToast('正在保存并构建...', 'info');
    try {
        await flushSave();
        const res = await apiFetch('/api/build', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            loadPreviewInPane(true);
            showToast('构建完成，已在预览栏中显示', 'success');
        } else {
            showToast('构建失败', 'error');
        }
    } catch (e) {
        if (!serverDead) showToast('构建请求失败', 'error');
    }
}

// 把当前已构建的站点加载到编辑器内的预览栏 iframe
// rebuild=true 时追加时间戳强制刷新，避免命中缓存
function loadPreviewInPane() {
    const iframe = $('preview-iframe');
    const placeholder = $('preview-placeholder');
    const wrap = $('preview-frame-wrap');
    if (!iframe) return;

    iframe.src = '/' + (iframe.dataset.loaded ? '?t=' + Date.now() : '');
    iframe.dataset.loaded = '1';

    if (placeholder) placeholder.classList.add('hidden');
    if (wrap) wrap.classList.remove('hidden');

    const urlBar = $('preview-url');
    if (urlBar) urlBar.textContent = location.origin + '/';

    switchTab('preview');
}

async function doBackup() {
    closeMenu();
    try {
        const res = await apiFetch('/api/backup', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(data.skipped ? '配置与最近备份相同，未创建新备份' : '备份已创建', 'success');
        } else {
            showToast('备份失败: ' + data.error, 'error');
        }
    } catch (e) {
        if (!serverDead) showToast('备份失败', 'error');
    }
}

async function doRollback() {
    closeMenu();
    try {
        const res = await apiFetch('/api/backups');
        const data = await res.json();
        const backups = data.backups || [];

        if (backups.length === 0) {
            showToast('没有可用的备份', 'warning');
            return;
        }

        // 第一步：展示备份列表
        const overlay = $('modal-overlay');
        const title = $('modal-title');
        const body = $('modal-body');

        title.textContent = '从备份恢复';
        const backupList = backups.map(b => {
            const time = new Date(b.time).toLocaleString('zh-CN');
            const size = (b.size / 1024).toFixed(1) + ' KB';
            return `<div class="backup-item" data-backup="${esc(b.name)}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:var(--radius-sm);cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--input-border)'">
                <div>
                    <div style="font-size:13px;color:var(--text)">${time}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${esc(b.name)} · ${size}</div>
                </div>
                <i class="fa-solid fa-clock-rotate-left" style="color:var(--text3)"></i>
            </div>`;
        }).join('');

        body.innerHTML = `
            <p style="color:var(--text-secondary);margin-bottom:12px;font-size:13px">选择一个备份恢复（最多保留 10 份，恢复前当前配置会自动备份）：</p>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:380px;overflow-y:auto">${backupList}</div>
            <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">取消</button></div>
        `;
        overlay.classList.add('active');

        // 第二步：点击某项 → 二次确认 → 恢复
        body.querySelectorAll('.backup-item').forEach(item => {
            item.addEventListener('click', () => {
                const backupName = item.dataset.backup;
                const timeText = item.querySelector('div > div:first-child').textContent;
                showRestoreConfirm(backupName, timeText);
            });
        });
    } catch (e) {
        if (!serverDead) showToast('获取备份列表失败', 'error');
    }
}

function showRestoreConfirm(backupName, timeText) {
    const title = $('modal-title');
    const body = $('modal-body');
    title.textContent = '确认恢复？';
    body.innerHTML = `
        <div style="text-align:center;padding:8px 0">
            <i class="fa-solid fa-clock-rotate-left" style="font-size:36px;color:var(--info);display:block;margin-bottom:10px"></i>
            <p style="color:var(--text-secondary);margin-bottom:6px">将把配置恢复到这个快照：</p>
            <p style="font-family:var(--mono);font-size:13px;color:var(--text);margin-bottom:4px">${esc(backupName)}</p>
            <p style="color:var(--text3);font-size:12px">${esc(timeText)}</p>
            <p style="color:var(--text3);font-size:12px;margin-top:12px">恢复前会自动备份当前配置，随时可以再恢复回来</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="btn-sm" onclick="closeModal()">取消</button>
            <button class="btn-sm danger" id="btn-confirm-restore">确认恢复</button>
        </div>
    `;
    const confirmBtn = $('btn-confirm-restore');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            closeModal();
            showToast('正在恢复...', 'info');
            try {
                // 恢复前先备份当前配置
                await apiFetch('/api/backup', { method: 'POST' });
                const restoreRes = await apiFetch('/api/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: backupName }),
                });
                const restoreData = await restoreRes.json();
                if (restoreData.success) {
                    showToast('恢复成功，正在重新加载...', 'success');
                    setTimeout(() => location.reload(), 800);
                } else {
                    showToast('恢复失败: ' + restoreData.error, 'error');
                }
            } catch (e) {
                if (!serverDead) showToast('恢复失败', 'error');
            }
        });
    }
}

async function doReset() {
    closeMenu();
    const overlay = $('modal-overlay');
    const title = $('modal-title');
    const body = $('modal-body');

    // 先查有没有未发布的修改，没有就不需要恢复
    let modified = true;
    try {
        const res = await apiFetch('/api/status');
        const data = await res.json();
        modified = !!data.configModified;
    } catch (e) { /* 状态查不到时按有修改处理 */ }

    if (!modified) {
        title.textContent = '没有需要恢复的内容';
        body.innerHTML = `
            <div style="text-align:center;padding:10px 0">
                <i class="fa-solid fa-circle-check" style="font-size:36px;color:var(--success);display:block;margin-bottom:10px"></i>
                <p style="color:var(--text-secondary)">当前配置与最近发布的版本一致，无需恢复</p>
            </div>
            <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>
        `;
        overlay.classList.add('active');
        return;
    }

    title.textContent = '恢复到发布版';
    body.innerHTML = `
        <div style="text-align:center;padding:8px 0">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:36px;color:var(--warn);display:block;margin-bottom:10px"></i>
            <p style="color:var(--text-secondary);margin-bottom:6px">将把配置恢复到最近一次发布（git 提交）的版本</p>
            <p style="color:var(--text3);font-size:12px">当前所有未发布的修改会被丢弃</p>
            <p style="color:var(--text3);font-size:12px;margin-top:10px"><i class="fa-solid fa-shield-halved"></i> 丢弃前会自动备份，可从「从备份恢复」找回</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="btn-sm" onclick="closeModal()">取消</button>
            <button class="btn-sm danger" id="btn-confirm-reset">确认恢复</button>
        </div>
    `;
    overlay.classList.add('active');
    const confirmBtn = $('btn-confirm-reset');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            closeModal();
            showToast('正在恢复到发布版...', 'info');
            try {
                // 丢弃前自动备份
                await apiFetch('/api/backup', { method: 'POST' });
                const res = await apiFetch('/api/reset', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast('已恢复到发布版，重新加载中...', 'success');
                    setTimeout(() => location.reload(), 800);
                } else {
                    showToast('恢复失败: ' + data.error, 'error');
                }
            } catch (e) {
                if (!serverDead) showToast('恢复失败', 'error');
            }
        });
    }
}

function openPreviewInNewTab() {
    window.open('/', '_blank');
}

async function doPublish() {
    const overlay = $('modal-overlay');
    const title = $('modal-title');
    const body = $('modal-body');

    // 第一步：强制保存当前配置（防止 debounce 未触发，把旧配置发出去）
    title.textContent = '准备发布...';
    body.innerHTML = `<div class="modal-spinner"><div class="spinner"></div><span>正在保存最新配置...</span></div>`;
    overlay.classList.add('active');
    try {
        await flushSave();
    } catch (e) { /* saveConfig 内部已提示，继续用已保存内容发布 */ }

    // 第二步：构建 → 提交 → 推送
    title.textContent = '发布中...';
    body.innerHTML = `<div class="modal-spinner"><div class="spinner"></div><span>正在构建并推送到 GitHub...</span></div>`;

    try {
        const res = await apiFetch('/api/publish', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            title.textContent = '发布成功';
            body.innerHTML = `
                <div style="text-align:center;padding:8px 0">
                    <i class="fa-solid fa-check" style="font-size:36px;color:var(--success);display:block;margin-bottom:10px"></i>
                    <p style="color:var(--text-secondary);margin-bottom:6px">已推送到 GitHub</p>
                    <p style="color:var(--text-secondary);font-size:12px;margin-bottom:14px">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        Cloudflare Pages 检测到推送后将自动构建部署，约 1 分钟后线上生效
                    </p>
                </div>
                <div class="modal-output">${esc(data.output)}</div>
                <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>`;
            loadPreviewInPane(true);   // 发布后同步刷新编辑器内预览栏
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
        if (serverDead) return;   // 横幅已给出重启指引，不再弹失败弹窗
        title.textContent = '发布失败';
        body.innerHTML = `<div class="modal-output">${esc(e.message)}</div>
            <div style="text-align:right;margin-top:14px"><button class="btn-sm" onclick="closeModal()">关闭</button></div>`;
    }
}

function closeModal() { $('modal-overlay').classList.remove('active'); }

// 关闭顶部 ⋯ 下拉菜单
function closeMenu() {
    const wrap = $('menu-wrap');
    if (wrap) wrap.classList.remove('open');
}

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
    $('btn-backup')?.addEventListener('click', doBackup);
    $('btn-rollback')?.addEventListener('click', doRollback);
    $('btn-reset')?.addEventListener('click', doReset);
    $('btn-publish').addEventListener('click', doPublish);
    $('btn-refresh-preview').addEventListener('click', () => { $('preview-iframe').src = $('preview-iframe').src; });
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });

    // 顶部 ⋯ 下拉菜单
    const btnMore = $('btn-more');
    if (btnMore) {
        btnMore.addEventListener('click', (e) => {
            e.stopPropagation();
            $('menu-wrap').classList.toggle('open');
        });
    }
    document.addEventListener('click', (e) => {
        const wrap = $('menu-wrap');
        if (wrap && !wrap.contains(e.target)) closeMenu();
    });

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
        if (e.key === 'Escape') closeMenu();
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
