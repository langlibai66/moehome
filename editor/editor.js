/**
 * MoeWah Editor — Visual Configuration Editor v2
 * 直接操作配置对象 + 完整变更链路
 */

// ============================================================
// CONFIG PARSER — 将 config.js 解析为结构化对象
// ============================================================
function parseConfig(raw) {
    const c = raw;

    function grab(pattern, fallback) {
        const m = c.match(pattern);
        return m && m[1] !== undefined ? m[1] : fallback;
    }

    function grabArr(pattern) {
        const m = c.match(pattern);
        if (!m) return [];
        const items = [];
        const re = /['"`]([^'"`]+)['"`]/g;
        let x;
        while ((x = re.exec(m[1]))) items.push(x[1]);
        return items;
    }

    function grabLinks() {
        const m = c.match(/links:\s*\[([\s\S]*?)\n\s*\]/);
        if (!m) return [];
        const links = [];
        const re = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
        let x;
        while ((x = re.exec(m[1]))) {
            const o = x[1];
            const name = val(o, 'name');
            const url = val(o, 'url');
            if (!name || !url) continue;
            links.push({
                name, description: val(o, 'description') || '',
                url, icon: val(o, 'icon') || 'fa-solid fa-link',
                brand: val(o, 'brand') || 'link',
                color: val(o, 'color') || '#00ff9f',
                external: bool(o, 'external'),
                enabled: bool(o, 'enabled', true),
                antiCrawler: bool(o, 'antiCrawler', true),
            });
        }
        return links;
    }

    function val(o, k) {
        const ps = [
            new RegExp(k + ':\\s*"((?:[^"\\\\]|\\\\.)*)"'),
            new RegExp(k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"),
            new RegExp(k + ':\\s*`((?:[^`\\\\]|\\\\.)*)`'),
        ];
        for (const p of ps) { const m = o.match(p); if (m) return m[1].replace(/\\(['"`\\])/g, '$1'); }
        return '';
    }

    function bool(o, k, def) {
        const m = o.match(new RegExp(k + ':\\s*(true|false)'));
        return m ? m[1] === 'true' : !!def;
    }

    return {
        site: {
            name: grab(/name:\s*['"`]([^'"`]+)['"`]/),
            tagline: grab(/tagline:\s*['"`]([^'"`]+)['"`]/),
            url: grab(/url:\s*['"`]([^'"`]+)['"`]/),
        },
        profile: {
            name: grab(/profile:[\s\S]*?name:\s*['"`]([^'"`]+)['"`]/),
            taglinePrefix: grab(/tagline:\s*\{[\s\S]*?prefix:\s*['"`]([^'"`]+)['"`]/),
            taglineHighlight: grab(/tagline:\s*\{[\s\S]*?highlight:\s*['"`]([^'"`]+)['"`]/),
        },
        identity: grabArr(/identity:\s*\[([\s\S]*?)\n\s*\]/),
        interests: grabArr(/interests:\s*\[([\s\S]*?)\n\s*\]/),
        terminal: {
            title: grab(/terminal:[\s\S]*?title:\s*['"`]([^'"`]+)['"`]/),
        },
        quotes: grabArr(/quotes:\s*\[([\s\S]*?)\n\s*\]/),
        theme: {
            default: grab(/theme:[\s\S]*?default:\s*['"`](light|dark|auto)['"`]/),
            lightScheme: grab(/theme:[\s\S]*?light:\s*['"`]([^'"`]+)['"`]/),
            darkScheme: grab(/theme:[\s\S]*?dark:\s*['"`]([^'"`]+)['"`]/),
        },
        projects: {
            enabled: bool(c.match(/projects:[\s\S]*?\}/)?.[1] || '', 'enabled'),
            titleText: grab(/projects:[\s\S]*?text:\s*['"`]([^'"`]+)['"`]/),
            githubUser: grab(/projects:[\s\S]*?githubUser:\s*['"`]([^'"`]+)['"`]/),
            count: parseInt(grab(/projects:[\s\S]*?count:\s*(\d+)/)) || 6,
        },
        contribution: {
            enabled: bool(c.match(/contribution:\s*\{[\s\S]*?\}/)?.[1] || '', 'enabled'),
            useRealData: bool(c.match(/contribution:\s*\{[\s\S]*?\}/)?.[1] || '', 'useRealData'),
        },
        rss: {
            enabled: bool(c.match(/rss:[\s\S]*?\},\s*\n\s*\/\//)?.[1] || '', 'enabled'),
            url: grab(/rss:[\s\S]*?url:\s*['"`]([^'"`]+)['"`]/),
        },
        linksConfig: {
            enabled: bool(c.match(/linksConfig:[\s\S]*?\}/)?.[1] || '', 'enabled'),
            titleText: grab(/linksConfig:[\s\S]*?text:\s*['"`]([^'"`]+)['"`]/),
        },
        links: grabLinks(),
        notice: {
            enabled: bool(c.match(/notice:[\s\S]*?\}/)?.[1] || '', 'enabled'),
            text: grab(/notice:[\s\S]*?text:\s*['"`]([^'"`]+)['"`]/),
        },
        footer: {
            copyrightYear: grab(/footer:[\s\S]*?year:\s*['"`]([^'"`]+)['"`]/),
            copyrightName: grab(/footer:[\s\S]*?name:\s*['"`]([^'"`]+)['"`]/),
        },
        analytics: {
            gaEnabled: bool(c.match(/analytics:[\s\S]*?googleAnalytics:\s*\{[\s\S]*?\}/)?.[1] || '', 'enabled'),
            gaId: grab(/id:\s*['"`](G-[^'"`]+)['"`]/),
        },
    };
}

// ============================================================
// STATE
// ============================================================
let rawConfig = '';
let cfg = {};
let saveTimer = null;

const $ = id => document.getElementById(id);

// ============================================================
// CONFIG WRITER — 将结构化数据写回 config.js
// ============================================================
function buildConfigSource() {
    let s = rawConfig;

    function repl(key, val) {
        const patterns = [
            new RegExp(key + ':\\s*["`]([^"`]*)["`]'),
            new RegExp(key + ":\\s*'([^']*)'"),
            new RegExp(key + ':\\s*(true|false)'),
            new RegExp(key + ':\\s*(\\d+(?:\\.\\d+)?)'),
        ];
        for (const p of patterns) {
            if (p.test(s)) {
                if (typeof val === 'boolean') return s.replace(p, key + ': ' + val);
                if (typeof val === 'number') return s.replace(p, key + ': ' + val);
                return s.replace(p, key + ': "' + String(val).replace(/"/g, '\\"') + '"');
            }
        }
        return s;
    }

    // Site
    s = repl('name', cfg.site?.name || '');
    s = repl('tagline', cfg.site?.tagline || '');
    s = repl('url', cfg.site?.url || '');

    // Profile
    s = repl('name', cfg.profile?.name || '');
    s = repl('prefix', cfg.profile?.taglinePrefix || '');
    s = repl('highlight', cfg.profile?.taglineHighlight || '');

    // Identity
    s = replaceArray(s, 'identity', cfg.identity || []);
    s = replaceArray(s, 'interests', cfg.interests || []);
    s = replaceArray(s, 'quotes', cfg.quotes || []);

    // Terminal
    s = repl('title', cfg.terminal?.title || '');

    // Theme
    s = repl('default', cfg.theme?.default || 'auto');
    s = repl('light', cfg.theme?.lightScheme || '');
    s = repl('dark', cfg.theme?.darkScheme || '');

    // Projects
    s = repl('enabled', cfg.projects?.enabled ?? true);
    s = repl('text', cfg.projects?.titleText || '');
    s = repl('githubUser', cfg.projects?.githubUser || '');
    s = repl('count', cfg.projects?.count || 6);

    // Contribution
    s = repl('enabled', cfg.contribution?.enabled ?? true);
    s = repl('useRealData', cfg.contribution?.useRealData ?? true);

    // RSS
    s = repl('enabled', cfg.rss?.enabled ?? false);
    s = repl('url', cfg.rss?.url || '');

    // Links
    s = repl('enabled', cfg.linksConfig?.enabled ?? true);
    s = repl('text', cfg.linksConfig?.titleText || '');
    s = rebuildLinks(s, cfg.links || []);

    // Notice
    s = repl('enabled', cfg.notice?.enabled ?? false);
    s = repl('text', cfg.notice?.text || '');

    // Footer
    s = repl('year', cfg.footer?.copyrightYear || '');
    s = repl('name', cfg.footer?.copyrightName || '');

    return s;
}

function replaceArray(source, key, items) {
    const pattern = new RegExp(key + ':\\s*\\[[\\s\\S]*?\\n\\s*\\]');
    const arrStr = items.map(v => `        "${v.replace(/"/g, '\\"')}"`).join(',\n');
    const replacement = key + ': [\n' + arrStr + '\n    ]';
    return source.replace(pattern, replacement);
}

function rebuildLinks(source, links) {
    const pattern = /links:\s*\[[\s\S]*?\n\s*\]/;
    let linksStr = 'links: [\n';
    links.forEach((l, i) => {
        linksStr += '        {\n';
        linksStr += `            name: "${l.name.replace(/"/g, '\\"')}",\n`;
        linksStr += `            description: "${(l.description || '').replace(/"/g, '\\"')}",\n`;
        linksStr += `            url: "${l.url.replace(/"/g, '\\"')}",\n`;
        linksStr += `            icon: "${l.icon.replace(/"/g, '\\"')}",\n`;
        linksStr += `            brand: "${l.brand.replace(/"/g, '\\"')}",\n`;
        linksStr += `            color: "${l.color || '#00ff9f'}",\n`;
        linksStr += `            external: ${l.external},\n`;
        linksStr += `            enabled: ${l.enabled},\n`;
        linksStr += `            antiCrawler: ${l.antiCrawler},\n`;
        linksStr += '        }';
        if (i < links.length - 1) linksStr += ',';
        linksStr += '\n';
    });
    linksStr += '    ]';
    return source.replace(pattern, linksStr);
}

// ============================================================
// INIT
// ============================================================
async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        rawConfig = data.content;
        cfg = parseConfig(rawConfig);
        renderCards();
        showStatus('ready');
    } catch (e) {
        showToast('加载配置失败: ' + e.message, 'error');
    }
}

// ============================================================
// CARD DEFINITIONS — 声明式卡片列表
// ============================================================
const CARD_DEFS = [
    {
        id: 'site', icon: 'fa-globe', color: '#4a9eff',
        title: '站点基础', fields: [
            { label: '站点名称', key: 'site.name', type: 'text', placeholder: '杨晨旭' },
            { label: '站点标语', key: 'site.tagline', type: 'text', placeholder: '开发者 / 技术爱好者' },
            { label: '站点 URL', key: 'site.url', type: 'text', placeholder: 'https://example.com' },
        ]
    },
    {
        id: 'profile', icon: 'fa-user', color: '#b066ff',
        title: '个人资料', fields: [
            { label: '显示名称', key: 'profile.name', type: 'text' },
            { label: '个性签名前缀', key: 'profile.taglinePrefix', type: 'text', placeholder: '🐱' },
            { label: '个性签名高亮', key: 'profile.taglineHighlight', type: 'text', placeholder: '欢迎来到我的主页' },
        ]
    },
    {
        id: 'identity', icon: 'fa-fingerprint', color: '#ff4d6a',
        title: '身份标签 & 兴趣', sections: [
            { label: '身份标签', itemsKey: 'identity' },
            { label: '兴趣领域', itemsKey: 'interests' },
        ]
    },
    {
        id: 'terminal', icon: 'fa-terminal', color: '#27c93f',
        title: '终端 & 语录', fields: [
            { label: '终端标题', key: 'terminal.title', type: 'text', placeholder: '🐱 user@host:~|' },
        ],
        sections: [
            { label: '名人语录', itemsKey: 'quotes' },
        ]
    },
    {
        id: 'theme', icon: 'fa-palette', color: '#ff9500',
        title: '主题配色', fields: [
            { label: '默认模式', key: 'theme.default', type: 'select', options: [
                { v: 'auto', l: '跟随系统' }, { v: 'light', l: '浅色' }, { v: 'dark', l: '暗色' }
            ]},
            { label: '浅色配色方案', key: 'theme.lightScheme', type: 'text', placeholder: 'coralOrange' },
            { label: '暗色配色方案', key: 'theme.darkScheme', type: 'text', placeholder: 'catppuccinMocha' },
        ]
    },
    {
        id: 'links', icon: 'fa-link', color: '#00a1ff',
        title: '链接导航',
        toggle: { label: '启用链接模块', key: 'linksConfig.enabled', get: () => cfg.linksConfig?.enabled ?? true },
        extraTitle: () => `${(cfg.links || []).length} 条`,
        sections: [
            { label: '链接列表', itemsKey: 'links', isLinks: true },
        ],
        addButton: { label: '添加链接', action: 'addLink' },
    },
    {
        id: 'projects', icon: 'fa-folder-open', color: '#ff9500',
        title: 'GitHub 项目', fields: [
            { label: '启用项目展示', key: 'projects.enabled', type: 'toggle', get: () => cfg.projects?.enabled ?? true },
            { label: '板块标题', key: 'projects.titleText', type: 'text', placeholder: '我的项目' },
            { label: 'GitHub 用户名', key: 'projects.githubUser', type: 'text', placeholder: 'yourusername' },
            { label: '显示数量', key: 'projects.count', type: 'number', min: 1, max: 12 },
        ]
    },
    {
        id: 'contribution', icon: 'fa-chart-bar', color: '#9b59b6',
        title: '贡献图', fields: [
            { label: '启用贡献图', key: 'contribution.enabled', type: 'toggle', get: () => cfg.contribution?.enabled ?? true },
            { label: '使用真实数据', key: 'contribution.useRealData', type: 'toggle', get: () => cfg.contribution?.useRealData ?? true },
        ]
    },
    {
        id: 'notice', icon: 'fa-shield-halved', color: '#ff3b3b',
        title: '安全提示', fields: [
            { label: '启用提示', key: 'notice.enabled', type: 'toggle', get: () => cfg.notice?.enabled ?? false },
            { label: '提示内容', key: 'notice.text', type: 'text', placeholder: '输入提示内容...' },
        ]
    },
    {
        id: 'footer', icon: 'fa-shoe-prints', color: '#5c7cfa',
        title: '页脚', fields: [
            { label: '版权年份', key: 'footer.copyrightYear', type: 'text' },
            { label: '版权名称', key: 'footer.copyrightName', type: 'text' },
        ]
    },
    {
        id: 'analytics', icon: 'fa-chart-line', color: '#e4a853',
        title: '统计分析', fields: [
            { label: 'Google Analytics', key: 'analytics.gaEnabled', type: 'toggle', get: () => cfg.analytics?.gaEnabled ?? false },
            { label: 'GA ID', key: 'analytics.gaId', type: 'text', placeholder: 'G-XXXXXXXXXX' },
        ]
    },
];

// ============================================================
// VALUE HELPERS — 从嵌套对象取值/设值
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

    const badge = def.extraTitle ? def.extraTitle() :
                  (def.sections?.some(s => s.isLinks) ? `${(cfg.links || []).length} 条` :
                   def.id);

    let bodyHTML = '';

    // Toggle field (standalone)
    if (def.toggle) {
        const val = def.toggle.get ? def.toggle.get() : getVal(def.toggle.key);
        bodyHTML += toggleHTML(def.toggle.label, def.toggle.key, val);
    }

    // Regular fields
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

    // Array sections (identity, interests, quotes, links)
    if (def.sections) {
        for (const sec of def.sections) {
            bodyHTML += arraySectionHTML(sec, def.id);
        }
    }

    // Add button
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

    // Bind card toggle
    el.querySelector('.card-header').addEventListener('click', () => {
        el.classList.toggle('collapsed');
    });

    // Bind all input events
    bindCardEvents(el, def);

    return el;
}

// ============================================================
// FIELD HTML BUILDERS
// ============================================================
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function textHTML(label, key, value, opts) {
    return `<div class="field-group">
        <label class="field-label">${esc(label)}</label>
        <input type="text" data-key="${key}" value="${esc(value)}" placeholder="${esc(opts?.placeholder || '')}" ${opts?.mono ? 'style="font-family:var(--font-mono);font-size:12px"' : ''}>
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
            <div class="toggle ${value ? 'active' : ''}" data-key="${key}" data-toggle></div>
            <span class="toggle-label">${esc(label)}</span>
        </div>
    </div>`;
}

function arraySectionHTML(sec, cardId) {
    const itemsKey = sec.itemsKey;
    const items = cfg[itemsKey] || [];

    let itemsHTML = '';
    if (sec.isLinks) {
        // Special rendering for links
        items.forEach((link, i) => {
            itemsHTML += linkItemHTML(i, link);
        });
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
            <div class="field-group" style="grid-column:1/-1">
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
                <div class="toggle ${link.enabled !== false ? 'active' : ''}" data-link-toggle="${index}:enabled"></div>
                <span class="toggle-label">启用</span>
            </div>
            <div class="toggle-wrap">
                <div class="toggle ${link.antiCrawler ? 'active' : ''}" data-link-toggle="${index}:antiCrawler"></div>
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
function bindCardEvents(cardEl, def) {
    // Text / number inputs
    cardEl.querySelectorAll('input[data-key]').forEach(input => {
        input.addEventListener('input', () => {
            setVal(input.dataset.key, input.value);
        });
    });

    // Select
    cardEl.querySelectorAll('select[data-key]').forEach(sel => {
        sel.addEventListener('change', () => {
            setVal(sel.dataset.key, sel.value);
        });
    });

    // Toggles
    cardEl.querySelectorAll('[data-toggle]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            setVal(toggle.dataset.key, toggle.classList.contains('active'));
        });
    });

    // Array item inputs
    cardEl.querySelectorAll('input[data-array]').forEach(input => {
        input.addEventListener('input', () => {
            const key = input.dataset.array;
            const idx = parseInt(input.dataset.idx);
            if (cfg[key]) {
                cfg[key][idx] = input.value;
                debouncedSave();
            }
        });
    });

    // Array remove
    cardEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const [key, idx] = btn.dataset.remove.split(':');
            if (cfg[key]) {
                cfg[key].splice(parseInt(idx), 1);
                renderCards();
                debouncedSave();
            }
        });
    });

    // Link field inputs
    cardEl.querySelectorAll('input[data-link]').forEach(input => {
        input.addEventListener('input', () => {
            const [idx, field] = input.dataset.link.split(':');
            const link = cfg.links && cfg.links[parseInt(idx)];
            if (link) {
                link[field] = input.value;
                debouncedSave();
            }
        });
    });

    // Link color sync
    cardEl.querySelectorAll('input[data-link-color]').forEach(picker => {
        picker.addEventListener('input', () => {
            const idx = parseInt(picker.dataset.linkColor);
            const textInput = cardEl.querySelector(`input[data-link="${idx}:color"]`);
            if (textInput) textInput.value = picker.value;
            if (cfg.links && cfg.links[idx]) {
                cfg.links[idx].color = picker.value;
                debouncedSave();
            }
        });
    });

    // Link toggle
    cardEl.querySelectorAll('[data-link-toggle]').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            const [idx, field] = toggle.dataset.linkToggle.split(':');
            if (cfg.links && cfg.links[parseInt(idx)]) {
                cfg.links[parseInt(idx)][field] = toggle.classList.contains('active');
                debouncedSave();
            }
        });
    });

    // Link remove
    cardEl.querySelectorAll('[data-remove-link]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.removeLink);
            if (cfg.links) {
                cfg.links.splice(idx, 1);
                renderCards();
                debouncedSave();
            }
        });
    });

    // Add link button
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
    // Card collapse/expand
    $('cards-container').addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const card = toggle.closest('.config-card');
            card.classList.toggle('collapsed');
            return;
        }
    });

    // Top bar buttons
    $('btn-build').addEventListener('click', doBuild);
    $('btn-publish').addEventListener('click', doPublish);
    $('btn-refresh-preview').addEventListener('click', () => { $('preview-iframe').src = $('preview-iframe').src; });
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal(); });

    // Preview tabs
    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.view));
    });

    // Build preview button
    $('btn-build').addEventListener('click', doBuild);

    // Preview actions
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

    // Collapse/expand all
    $('btn-collapse-all').addEventListener('click', () => {
        document.querySelectorAll('.config-card').forEach(c => c.classList.add('collapsed'));
    });
    $('btn-expand-all').addEventListener('click', () => {
        document.querySelectorAll('.config-card').forEach(c => c.classList.remove('collapsed'));
    });

    // Panel resizer
    setupResizer();

    // Keyboard shortcuts
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
