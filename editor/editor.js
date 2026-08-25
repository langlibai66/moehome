/**
 * MoeWah Editor — Visual Configuration Editor
 * 卡片式可视化编辑 + 实时预览 + 一键发布
 */

// ============================================================
// STATE
// ============================================================
const state = {
    rawConfig: '',          // config.js 原始内容
    config: null,           // 解析后的配置对象
    dirty: false,           // 是否有未保存的修改
};

// ============================================================
// DOM REFS
// ============================================================
const $ = id => document.getElementById(id);
const cardsContainer = $('cards-container');
const previewIframe = $('preview-iframe');
const configCode = $('config-code');
const configSource = $('config-source');
const saveStatus = $('save-status');
const toastContainer = $('toast-container');

// ============================================================
// INIT
// ============================================================
async function init() {
    await loadConfig();
    setupEventListeners();
}

// ============================================================
// CONFIG LOADING
// ============================================================
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        state.rawConfig = data.content;
        state.config = parseConfig(data.content);
        renderCards(state.config);
        updateSourceView();
        showToast('配置加载成功', 'success');
    } catch (err) {
        showToast('加载配置失败: ' + err.message, 'error');
    }
}

// ============================================================
// CONFIG PARSER — 从 config.js 提取结构化数据
// ============================================================
function parseConfig(content) {
    const c = content;
    return {
        site: extractObj(c, /site:\s*\{([\s\S]*?)\n\s*\},/, {
            name: ['name:\s*[\'"`]([^\'"`]+)[\'"`]'],
            tagline: ['tagline:\s*[\'"`]([^\'"`]+)[\'"`]'],
            url: ['url:\s*[\'"`]([^\'"`]+)[\'"`]'],
            ogImage: ['ogImage:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        seo: extractObj(c, /seo:\s*\{([\s\S]*?)\n\s*\},/, {
            title: ['title:\s*[\'"`]([^\'"`]+)[\'"`]'],
            description: ['description:\s*[\'"`]([^\'"`]+)[\'"`]'],
            keywords: extractArr(c, /keywords:\s*\[([\s\S]*?)\n\s*\]/),
        }),
        profile: extractObj(c, /profile:\s*\{([\s\S]*?)\n\s*\},/, {
            name: ['name:\s*[\'"`]([^\'"`]+)[\'"`]'],
            taglinePrefix: extractNested(c, /profile:\s*\{[\s\S]*?tagline:\s*\{([\s\S]*?)\n\s*\}/, 'prefix'),
            taglineHighlight: extractNested(c, /profile:\s*\{[\s\S]*?tagline:\s*\{([\s\S]*?)\n\s*\}/, 'highlight'),
            avatar: ['avatar:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        identity: extractArr(c, /identity:\s*\[([\s\S]*?)\n\s*\]/),
        interests: extractArr(c, /interests:\s*\[([\s\S]*?)\n\s*\]/),
        terminal: extractObj(c, /terminal:\s*\{([\s\S]*?)\n\s*\},/, {
            title: ['title:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        quotes: extractArr(c, /quotes:\s*\[([\s\S]*?)\n\s*\]/),
        theme: extractObj(c, /theme:\s*\{([\s\S]*?)\n\s*\},/, {
            defaultMode: ['default:\s*[\'"`](light|dark|auto)[\'"`]'],
            lightScheme: ['light:\s*[\'"`]([^\'"`]+)[\'"`]'],
            darkScheme: ['dark:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        projects: extractObj(c, /projects:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*\/\//, {
            enabled: ['enabled:\s*(true|false)'],
            titleText: ['text:\s*[\'"`]([^\'"`]+)[\'"`]'],
            titleIcon: ['icon:\s*[\'"`]([^\'"`]+)[\'"`]'],
            githubUser: ['githubUser:\s*[\'"`]([^\'"`]+)[\'"`]'],
            count: ['count:\s*(\d+)'],
        }),
        contribution: extractObj(c, /contribution:\s*\{([\s\S]*?)\n\s*\}/, {
            enabled: ['enabled:\s*(true|false)'],
            useRealData: ['useRealData:\s*(true|false)'],
            githubUser: ['githubUser:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        rss: extractObj(c, /rss:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*\/\//, {
            enabled: ['enabled:\s*(true|false)'],
            url: ['url:\s*[\'"`]([^\'"`]+)[\'"`]'],
            count: ['count:\s*(\d+)'],
            titleText: ['text:\s*[\'"`]([^\'"`]+)[\'"`]'],
            titleIcon: ['icon:\s*[\'"`]([^\'"`]+)[\'"`]'],
            showDate: ['showDate:\s*(true|false)'],
            showDescription: ['showDescription:\s*(true|false)'],
        }),
        linksConfig: extractObj(c, /linksConfig:\s*\{([\s\S]*?)\n\s*\},/, {
            enabled: ['enabled:\s*(true|false)'],
            titleText: ['text:\s*[\'"`]([^\'"`]+)[\'"`]'],
            titleIcon: ['icon:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        links: extractLinks(c),
        music: extractObj(c, /music:\s*\{([\s\S]*?)(?=\n\s*\},?\s*\n\s*\/\/|\n\s*\},?\s*$)/, {
            enabled: ['enabled:\s*(true|false)'],
            volume: ['volume:\s*([0-9.]+)'],
            mode: ['mode:\s*[\'"`]([^\'"`]+)[\'"`]'],
            metingServer: ['server:\s*[\'"`]([^\'"`]+)[\'"`]'],
            metingType: ['type:\s*[\'"`]([^\'"`]+)[\'"`]'],
            metingId: ['id:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        notice: extractObj(c, /notice:\s*\{([\s\S]*?)\n\s*\},/, {
            enabled: ['enabled:\s*(true|false)'],
            text: ['text:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        guestbook: extractObj(c, /guestbook:\s*\{([\s\S]*?)\n\s*\},/, {
            enabled: ['enabled:\s*(true|false)'],
        }),
        donation: extractObj(c, /donation:\s*\{([\s\S]*?)\n\s*\},/, {
            enabled: ['enabled:\s*(true|false)'],
            titleText: ['text:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        footer: extractObj(c, /footer:\s*\{([\s\S]*?)\n\s*\},/, {
            copyrightYear: ['year:\s*[\'"`]([^\'"`]+)[\'"`]'],
            copyrightName: ['name:\s*[\'"`]([^\'"`]+)[\'"`]'],
        }),
        analytics: extractObj(c, /analytics:\s*\{([\s\S]*?)\n\s*\}/, {
            gaId: ['id:\s*[\'"`]([^\'"`]+)[\'"`]'],
            gaEnabled: ['enabled:\s*(true|false)'],
            umami: ["umami:\\s*'([^']+)'"],
        }),
    };
}

function extractObj(content, pattern, fields) {
    const match = content.match(pattern);
    if (!match) return {};
    const block = match[1];
    const result = {};
    for (const [key, patterns] of Object.entries(fields)) {
        if (Array.isArray(patterns)) {
            for (const p of patterns) {
                const m = block.match(new RegExp(p));
                if (m) { result[key] = m[1]; break; }
            }
        }
    }
    return result;
}

function extractNested(content, pattern, key) {
    const match = content.match(pattern);
    if (!match) return '';
    const keyMatch = match[1].match(new RegExp(key + ':\\s*[\'"`]([^\'"`]+)[\'"`]'));
    return keyMatch ? keyMatch[1] : '';
}

function extractArr(content, pattern) {
    const match = content.match(pattern);
    if (!match) return [];
    const items = [];
    const re = /['"`]([^'"`]+)['"`]/g;
    let m;
    while ((m = re.exec(match[1]))) items.push(m[1]);
    return items;
}

function extractLinks(content) {
    const match = content.match(/links:\s*\[([\s\S]*?)\n\s*\]/);
    if (!match) return [];
    const links = [];
    const objRe = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let m;
    while ((m = objRe.exec(match[1]))) {
        const o = m[1];
        const name = val(o, "name");
        const url = val(o, "url");
        if (name && url) {
            links.push({
                name,
                description: val(o, 'description') || '',
                url,
                icon: val(o, 'icon') || 'fa-solid fa-link',
                brand: val(o, 'brand') || 'link',
                color: val(o, 'color') || '#00ff9f',
                external: bool(o, 'external'),
                enabled: bool(o, 'enabled', true),
                antiCrawler: bool(o, 'antiCrawler', true),
            });
        }
    }
    return links;
}

function val(content, key) {
    const patterns = [
        new RegExp(key + ':\\s*"((?:[^"\\\\]|\\\\.)*)"'),
        new RegExp(key + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"),
        new RegExp(key + ':\\s*`((?:[^`\\\\]|\\\\.)*)`'),
    ];
    for (const p of patterns) {
        const m = content.match(p);
        if (m) return m[1].replace(/\\(['"`\\])/g, '$1');
    }
    return null;
}

function bool(content, key, def = false) {
    const m = content.match(new RegExp(key + ':\\s*(true|false)'));
    return m ? m[1] === 'true' : def;
}

// ============================================================
// CARD RENDERING
// ============================================================
function renderCards(config) {
    cardsContainer.innerHTML = '';

    const cards = [
        { id: 'site', icon: 'fa-globe', iconBg: '#1a3a5c', title: '站点基础', badge: 'site', fields: () => cardFields([
            textField('站点名称', config.site?.name, v => setConfig('site.name', v), { placeholder: '杨晨旭' }),
            textField('站点标语', config.site?.tagline, v => setConfig('site.tagline', v), { placeholder: '开发者 / 技术爱好者' }),
            textField('站点 URL', config.site?.url, v => setConfig('site.url', v), { placeholder: 'https://example.com' }),
        ])},
        { id: 'profile', icon: 'fa-user', iconBg: '#3a1a5c', title: '个人资料', badge: 'profile', fields: () => cardFields([
            textField('显示名称', config.profile?.name, v => setConfig('profile.name', v)),
            textField('个性签名前缀', config.profile?.taglinePrefix, v => setConfig('profile.taglinePrefix', v), { placeholder: '🐱' }),
            textField('个性签名高亮', config.profile?.taglineHighlight, v => setConfig('profile.taglineHighlight', v), { placeholder: '欢迎来到我的主页' }),
        ])},
        { id: 'identity', icon: 'fa-fingerprint', iconBg: '#5c1a3a', title: '身份标签 & 兴趣', badge: 'identity', fields: () => {
            const items = (config.identity || []).map((v, i) => arrayItem('identity', i, v));
            const interestItems = (config.interests || []).map((v, i) => arrayItem('interests', i, v));
            return cardFields([
                arraySection('身份标签', config.identity || [], 'identity', items),
                arraySection('兴趣领域', config.interests || [], 'interests', interestItems),
            ]);
        }},
        { id: 'terminal', icon: 'fa-terminal', iconBg: '#1a4a3a', title: '终端 & 语录', badge: 'terminal', fields: () => cardFields([
            textField('终端标题', config.terminal?.title, v => setConfig('terminal.title', v), { placeholder: '🐱 user@host:~|' }),
            arraySection('名人语录', config.quotes || [], 'quotes', (config.quotes || []).map((v, i) => arrayItem('quotes', i, v))),
        ])},
        { id: 'theme', icon: 'fa-palette', iconBg: '#4a3a1a', title: '主题配色', badge: 'theme', fields: () => cardFields([
            selectField('默认模式', config.theme?.defaultMode, v => setConfig('theme.defaultMode', v), [
                { value: 'auto', label: '跟随系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '暗色' },
            ]),
            textField('浅色配色', config.theme?.lightScheme, v => setConfig('theme.lightScheme', v), { placeholder: 'coralOrange' }),
            textField('暗色配色', config.theme?.darkScheme, v => setConfig('theme.darkScheme', v), { placeholder: 'catppuccinMocha' }),
        ])},
        { id: 'links', icon: 'fa-link', iconBg: '#1a3a4a', title: '链接导航', badge: `${(config.links || []).length} links`, fields: () => {
            const linkItems = (config.links || []).map((l, i) => linkItemCard(i, l));
            return cardFields([
                toggleField('启用链接模块', config.linksConfig?.enabled, v => setConfig('linksConfig.enabled', v)),
                textField('模块标题', config.linksConfig?.titleText, v => setConfig('linksConfig.titleText', v)),
                ...linkItems,
                addLinkButton(),
            ]);
        }},
        { id: 'projects', icon: 'fa-folder-open', iconBg: '#3a2a1a', title: 'GitHub 项目', badge: 'github', fields: () => cardFields([
            toggleField('启用项目展示', config.projects?.enabled, v => setConfig('projects.enabled', v)),
            textField('板块标题', config.projects?.titleText, v => setConfig('projects.titleText', v), { placeholder: '我的项目' }),
            textField('GitHub 用户名', config.projects?.githubUser, v => setConfig('projects.githubUser', v), { placeholder: 'yourusername' }),
            numberField('显示数量', config.projects?.count, v => setConfig('projects.count', v), { min: 1, max: 12 }),
        ])},
        { id: 'contribution', icon: 'fa-chart-bar', iconBg: '#2a1a3a', title: '贡献图', badge: 'github', fields: () => cardFields([
            toggleField('启用贡献图', config.contribution?.enabled, v => setConfig('contribution.enabled', v)),
            toggleField('使用真实数据', config.contribution?.useRealData, v => setConfig('contribution.useRealData', v)),
            textField('GitHub 用户名', config.contribution?.githubUser, v => setConfig('contribution.githubUser', v)),
        ])},
        { id: 'notice', icon: 'fa-shield-halved', iconBg: '#3a1a1a', title: '安全提示', badge: 'notice', fields: () => cardFields([
            toggleField('启用提示', config.notice?.enabled, v => setConfig('notice.enabled', v)),
            textField('提示内容', config.notice?.text, v => setConfig('notice.text', v)),
        ])},
        { id: 'footer', icon: 'fa-shoe-prints', iconBg: '#1a2a2a', title: '页脚', badge: 'footer', fields: () => cardFields([
            textField('版权年份', config.footer?.copyrightYear, v => setConfig('footer.copyrightYear', v)),
            textField('版权名称', config.footer?.copyrightName, v => setConfig('footer.copyrightName', v)),
        ])},
        { id: 'analytics', icon: 'fa-chart-line', iconBg: '#2a2a1a', title: '统计分析', badge: 'stats', fields: () => cardFields([
            toggleField('Google Analytics', config.analytics?.gaEnabled, v => setConfig('analytics.gaEnabled', v)),
            textField('GA ID', config.analytics?.gaId, v => setConfig('analytics.gaId', v), { placeholder: 'G-XXXXXXXXXX' }),
            textField('Umami 脚本', config.analytics?.umami, v => setConfig('analytics.umami', v), { placeholder: "src='...'", monospace: true }),
        ])},
    ];

    cards.forEach(card => {
        cardsContainer.appendChild(createCardElement(card));
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'config-card';
    el.dataset.cardId = card.id;
    el.innerHTML = `
        <div class="card-header" data-toggle="${card.id}">
            <div class="card-header-left">
                <div class="card-icon" style="background:${card.iconBg}22;color:${card.iconBg}">
                    <i class="fa-solid ${card.icon}"></i>
                </div>
                <span class="card-title">${card.title}</span>
                <span class="card-badge">${card.badge}</span>
            </div>
            <i class="fa-solid fa-chevron-down card-toggle"></i>
        </div>
        <div class="card-body">${card.fields().join('')}</div>
    `;

    // Toggle collapse
    el.querySelector('.card-header').addEventListener('click', () => {
        el.classList.toggle('collapsed');
    });

    return el;
}

// ============================================================
// FIELD BUILDERS
// ============================================================
function cardFields(fields) { return fields; }

function textField(label, value, onChange, opts = {}) {
    const v = value || '';
    return `
        <div class="field-group">
            <label class="field-label">${label}</label>
            <input type="text" value="${escAttr(v)}" placeholder="${escAttr(opts.placeholder || '')}" data-path="${opts.path || ''}" data-onchange="${opts.path || ''}" ${opts.monospace ? 'style="font-family:var(--font-mono);font-size:12px;"' : ''}>
        </div>`;
}

function numberField(label, value, onChange, opts = {}) {
    const v = value || '';
    return `
        <div class="field-group">
            <label class="field-label">${label}</label>
            <input type="number" value="${v}" ${opts.min ? 'min="'+opts.min+'"' : ''} ${opts.max ? 'max="'+opts.max+'"' : ''}>
        </div>`;
}

function selectField(label, value, onChange, options) {
    const opts = options.map(o =>
        `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`
    ).join('');
    return `
        <div class="field-group">
            <label class="field-label">${label}</label>
            <select><option value="">-- 选择 --</option>${opts}</select>
        </div>`;
}

function toggleField(label, value, onChange) {
    const active = value ? 'active' : '';
    return `
        <div class="field-group">
            <div class="toggle-wrap">
                <div class="toggle ${active}" data-toggle-field></div>
                <span class="toggle-label">${label}</span>
            </div>
        </div>`;
}

function arraySection(title, items, path, itemEls) {
    return `
        <div class="field-group">
            <label class="field-label">${title} (${items.length})</label>
            <div class="array-list" data-array-path="${path}">
                ${itemEls.join('')}
            </div>
        </div>`;
}

function arrayItem(path, index, value) {
    return `
        <div class="array-item" data-array-index="${index}" data-array-path="${path}">
            <span style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono);min-width:20px">${index}</span>
            <input type="text" value="${escAttr(value || '')}" data-array-value="${index}">
            <button class="btn-icon danger" data-array-remove="${index}" title="删除">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>`;
}

function linkItemCard(index, link) {
    return `
        <div class="link-card-item" data-link-index="${index}">
            <div class="link-card-item-header">
                <span><i class="${link.icon}" style="margin-right:6px;color:${link.color}"></i>${esc(link.name)}</span>
                <button class="btn-icon danger" data-link-remove="${index}" title="删除链接">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <div class="link-card-fields">
                <div class="field-group">
                    <label class="field-label">名称</label>
                    <input type="text" value="${escAttr(link.name || '')}" data-link-field="${index}:name">
                </div>
                <div class="field-group">
                    <label class="field-label">图标 (FontAwesome class)</label>
                    <input type="text" value="${escAttr(link.icon || '')}" data-link-field="${index}:icon">
                </div>
                <div class="field-group full-width">
                    <label class="field-label">URL</label>
                    <input type="text" value="${escAttr(link.url || '')}" data-link-field="${index}:url">
                </div>
                <div class="field-group">
                    <label class="field-label">描述</label>
                    <input type="text" value="${escAttr(link.description || '')}" data-link-field="${index}:description">
                </div>
                <div class="field-group">
                    <label class="field-label">品牌颜色</label>
                    <div class="color-input-wrap">
                        <input type="color" value="${link.color || '#00ff9f'}" data-link-field="${index}:color">
                        <input type="text" value="${escAttr(link.color || '#00ff9f')}" data-link-field="${index}:color-text">
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                <div class="toggle-wrap">
                    <div class="toggle ${link.enabled !== false ? 'active' : ''}" data-link-toggle="${index}"></div>
                    <span class="toggle-label">启用</span>
                </div>
                <div class="toggle-wrap">
                    <div class="toggle ${link.antiCrawler ? 'active' : ''}" data-link-anticrawler="${index}"></div>
                    <span class="toggle-label">邮箱反爬</span>
                </div>
            </div>
        </div>`;
}

function addLinkButton() {
    return `
        <button class="btn-add" id="btn-add-link">
            <i class="fa-solid fa-plus"></i> 添加链接
        </button>`;
}

// ============================================================
// CONFIG UPDATE & WRITE
// ============================================================
function setConfig(path, value) {
    const parts = path.split('.');
    let obj = state.config;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    state.dirty = true;
    updateSourceView();
    flashSaveStatus('saving');
    debouncedSave();
}

function updateConfigFromDOM() {
    // Read all inputs and update state.config
    const cards = cardsContainer.querySelectorAll('.config-card');
    cards.forEach(card => {
        // Text inputs
        card.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
            if (input.dataset.onchange) {
                setConfig(input.dataset.onchange, input.value);
            }
            if (input.dataset.arrayValue !== undefined) {
                const path = input.closest('[data-array-path]')?.dataset.arrayPath;
                const idx = parseInt(input.dataset.arrayValue);
                if (path && state.config[path]) {
                    state.config[path][idx] = input.value;
                    state.dirty = true;
                }
            }
            if (input.dataset.linkField) {
                const [idx, field] = input.dataset.linkField.split(':');
                const link = state.config.links && state.config.links[parseInt(idx)];
                if (link) { link[field] = input.value; state.dirty = true; }
            }
        });
        // Selects
        card.querySelectorAll('select').forEach(sel => {
            const cardEl = card.closest('.config-card');
            const pathMap = { 'site': 'site', 'profile': 'profile', 'theme': 'theme' };
            const cardId = cardEl?.dataset.cardId;
            if (cardId === 'theme') {
                const key = sel.closest('.field-group')?.querySelector('.field-label')?.textContent;
                if (key === '默认模式') setConfig('theme.defaultMode', sel.value);
            }
        });
        // Toggles
        card.querySelectorAll('[data-toggle-field]').forEach(toggle => {
            const label = toggle.closest('.field-group')?.querySelector('.toggle-label')?.textContent || '';
            const pathMap = {
                '启用项目展示': 'projects.enabled',
                '启用贡献图': 'contribution.enabled',
                '使用真实数据': 'contribution.useRealData',
                '启用提示': 'notice.enabled',
                '启用链接模块': 'linksConfig.enabled',
                'Google Analytics': 'analytics.gaEnabled',
            };
            const path = pathMap[label];
            if (path) setConfig(path, toggle.classList.contains('active'));
        });
        // Link toggles
        card.querySelectorAll('[data-link-toggle]').forEach(toggle => {
            const idx = parseInt(toggle.dataset.linkToggle);
            if (state.config.links && state.config.links[idx]) {
                state.config.links[idx].enabled = toggle.classList.contains('active');
                state.dirty = true;
            }
        });
        card.querySelectorAll('[data-link-anticrawler]').forEach(toggle => {
            const idx = parseInt(toggle.dataset.anticrawler);
            if (state.config.links && state.config.links[idx]) {
                state.config.links[idx].antiCrawler = toggle.classList.contains('active');
                state.dirty = true;
            }
        });
    });
}

// ============================================================
// CONFIG WRITER — 将修改写回 config.js
// ============================================================
function writeConfigToFile() {
    let content = state.rawConfig;

    // Helper: replace value for a key in config
    function replaceValue(key, newValue, scope = null) {
        const patterns = [
            // String: key: "value" or key: 'value'
            new RegExp(key + ':\\s*["`]([^"`]*)["`]'),
            new RegExp(key + ':\\s*\'([^\']*)\''),
            // Boolean: key: true/false
            new RegExp(key + ':\\s*(true|false)'),
            // Number: key: 123
            new RegExp(key + ':\\s*(\\d+(?:\\.\\d+)?)'),
        ];

        for (const pattern of patterns) {
            if (pattern.test(content)) {
                if (typeof newValue === 'boolean') {
                    content = content.replace(pattern, key + ': ' + newValue);
                } else if (typeof newValue === 'number') {
                    content = content.replace(pattern, key + ': ' + newValue);
                } else {
                    content = content.replace(pattern, key + ': "' + newValue.replace(/"/g, '\\"') + '"');
                }
                return true;
            }
        }
        return false;
    }

    // Apply config changes
    for (const [key, value] of Object.entries(flattenConfig(state.config))) {
        if (value !== null && value !== undefined) {
            replaceValue(key, value);
        }
    }

    state.rawConfig = content;
    return content;
}

function flattenConfig(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? prefix + '.' + key : key;
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function') {
            Object.assign(result, flattenConfig(value, path));
        } else if (Array.isArray(value)) {
            // Arrays handled separately
        } else {
            result[path] = value;
        }
    }
    return result;
}

async function saveConfig() {
    updateConfigFromDOM();
    writeConfigToFile();

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: state.rawConfig }),
        });
        const data = await res.json();
        if (data.success) {
            state.dirty = false;
            flashSaveStatus('saved');
            showToast('配置已保存', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        flashSaveStatus('error');
        showToast('保存失败: ' + err.message, 'error');
    }
}

// ============================================================
// SOURCE VIEW
// ============================================================
function updateSourceView() {
    configCode.textContent = state.rawConfig;
}

// ============================================================
// PREVIEW
// ============================================================
async function buildAndPreview() {
    showToast('正在构建...', 'info');
    try {
        const res = await fetch('/api/build', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('构建完成，刷新预览', 'success');
            refreshPreview();
        } else {
            showToast('构建失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (err) {
        showToast('构建请求失败: ' + err.message, 'error');
    }
}

function refreshPreview() {
    previewIframe.src = previewIframe.src;
}

// ============================================================
// PUBLISH
// ============================================================
async function publish() {
    const modal = $('modal-overlay');
    $('modal-title').textContent = '发布中...';
    $('modal-body').innerHTML = `
        <div class="modal-spinner">
            <div class="spinner"></div>
            <span>正在构建并推送到 GitHub...</span>
        </div>`;
    modal.classList.add('active');

    try {
        const res = await fetch('/api/publish', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            $('modal-title').textContent = '发布成功';
            $('modal-body').innerHTML = `
                <div style="text-align:center;padding:10px 0">
                    <i class="fa-solid fa-circle-check" style="font-size:40px;color:var(--success);margin-bottom:12px;display:block"></i>
                    <p style="color:var(--text-secondary);margin-bottom:16px">已成功推送到 GitHub</p>
                </div>
                <div class="modal-output">${esc(data.output)}</div>
                <div style="text-align:right;margin-top:16px">
                    <button class="btn-sm" onclick="closeModal()">关闭</button>
                </div>`;
        } else {
            $('modal-title').textContent = '发布失败';
            $('modal-body').innerHTML = `
                <div style="text-align:center;padding:10px 0">
                    <i class="fa-solid fa-circle-xmark" style="font-size:40px;color:var(--error);margin-bottom:12px;display:block"></i>
                    <p style="color:var(--text-secondary);margin-bottom:16px">发布过程中出现错误</p>
                </div>
                <div class="modal-output">${esc(data.error || '未知错误')}</div>
                <div style="text-align:right;margin-top:16px">
                    <button class="btn-sm" onclick="closeModal()">关闭</button>
                </div>`;
        }
    } catch (err) {
        $('modal-title').textContent = '发布失败';
        $('modal-body').innerHTML = `
            <div class="modal-output">${esc(err.message)}</div>
            <div style="text-align:right;margin-top:16px">
                <button class="btn-sm" onclick="closeModal()">关闭</button>
            </div>`;
    }
}

function closeModal() {
    $('modal-overlay').classList.remove('active');
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Card toggles
    cardsContainer.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const card = toggle.closest('.config-card');
            card.classList.toggle('collapsed');
            return;
        }

        // Toggle switches
        const toggleEl = e.target.closest('[data-toggle-field]');
        if (toggleEl) {
            toggleEl.classList.toggle('active');
            const label = toggleEl.closest('.field-group')?.querySelector('.toggle-label')?.textContent || '';
            const pathMap = {
                '启用项目展示': 'projects.enabled',
                '启用贡献图': 'contribution.enabled',
                '使用真实数据': 'contribution.useRealData',
                '启用提示': 'notice.enabled',
                '启用链接模块': 'linksConfig.enabled',
                'Google Analytics': 'analytics.gaEnabled',
            };
            if (pathMap[label]) setConfig(pathMap[label], toggleEl.classList.contains('active'));
            return;
        }

        // Link toggles
        const linkToggle = e.target.closest('[data-link-toggle]');
        if (linkToggle) {
            linkToggle.classList.toggle('active');
            const idx = parseInt(linkToggle.dataset.linkToggle);
            if (state.config.links && state.config.links[idx]) {
                state.config.links[idx].enabled = linkToggle.classList.contains('active');
                state.dirty = true;
                updateSourceView(); debouncedSave();
            }
            return;
        }
        const acToggle = e.target.closest('[data-link-anticrawler]');
        if (acToggle) {
            acToggle.classList.toggle('active');
            const idx = parseInt(acToggle.dataset.anticrawler);
            if (state.config.links && state.config.links[idx]) {
                state.config.links[idx].antiCrawler = acToggle.classList.contains('active');
                state.dirty = true;
                updateSourceView(); debouncedSave();
            }
            return;
        }

        // Remove array item
        const removeBtn = e.target.closest('[data-array-remove]');
        if (removeBtn) {
            const idx = parseInt(removeBtn.dataset.arrayRemove);
            const path = removeBtn.closest('[data-array-path]')?.dataset.arrayPath;
            if (path && state.config[path]) {
                state.config[path].splice(idx, 1);
                state.dirty = true;
                renderCards(state.config);
                updateSourceView();
                debouncedSave();
            }
            return;
        }

        // Remove link
        const linkRemove = e.target.closest('[data-link-remove]');
        if (linkRemove) {
            const idx = parseInt(linkRemove.dataset.linkRemove);
            if (state.config.links) {
                state.config.links.splice(idx, 1);
                state.dirty = true;
                renderCards(state.config);
                updateSourceView();
                debouncedSave();
            }
            return;
        }

        // Add link
        if (e.target.closest('#btn-add-link')) {
            if (state.config.links) {
                state.config.links.push({
                    name: '新链接', description: '描述', url: 'https://',
                    icon: 'fa-solid fa-link', brand: 'link', color: '#00ff9f',
                    external: true, enabled: true, antiCrawler: false,
                });
                state.dirty = true;
                renderCards(state.config);
                updateSourceView();
                debouncedSave();
            }
            return;
        }
    });

    // Input changes
    cardsContainer.addEventListener('input', (e) => {
        const input = e.target;
        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA' || input.tagName === 'SELECT') {
            // Sync color picker + text
            if (input.type === 'color') {
                const textInput = input.nextElementSibling;
                if (textInput && textInput.tagName === 'INPUT') textInput.value = input.value;
            }
            if (input.dataset.linkField && input.type !== 'color') {
                const [idx, field] = input.dataset.linkField.split(':');
                if (state.config.links && state.config.links[parseInt(idx)]) {
                    state.config.links[parseInt(idx)][field] = input.value;
                    state.dirty = true;
                    updateSourceView();
                    debouncedSave();
                }
            }
        }
    });

    // Color input sync
    cardsContainer.addEventListener('input', (e) => {
        if (e.target.type === 'color') {
            const textInput = e.target.nextElementSibling;
            if (textInput && textInput.tagName === 'INPUT') {
                textInput.value = e.target.value;
            }
        }
        if (e.target.dataset.linkField && e.target.type !== 'color') {
            const parts = e.target.dataset.linkField.split(':');
            if (parts[1] === 'color' && e.target.tagName === 'INPUT') {
                // Check if it's the text field (not color picker)
                const idx = parseInt(parts[0]);
                const colorPicker = cardsContainer.querySelector(`input[type="color"][data-link-field="${idx}:color"]`);
                if (colorPicker && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    colorPicker.value = e.target.value;
                }
            }
        }
    });

    // Select changes
    cardsContainer.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            const label = e.target.closest('.field-group')?.querySelector('.field-label')?.textContent || '';
            if (label === '默认模式') {
                setConfig('theme.defaultMode', e.target.value);
            }
        }
    });

    // Buttons
    $('btn-build').addEventListener('click', buildAndPreview);
    $('btn-publish').addEventListener('click', publish);
    $('btn-refresh-preview').addEventListener('click', refreshPreview);
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => {
        if (e.target === $('modal-overlay')) closeModal();
    });

    // Preview tabs
    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            if (view === 'preview') {
                previewIframe.style.display = 'block';
                configSource.classList.remove('visible');
                configSource.classList.add('hidden');
            } else {
                previewIframe.style.display = 'none';
                configSource.classList.remove('hidden');
                configSource.classList.add('visible');
                updateSourceView();
            }
        });
    });

    // Collapse / Expand all
    $('btn-collapse-all').addEventListener('click', () => {
        cardsContainer.querySelectorAll('.config-card').forEach(c => c.classList.add('collapsed'));
    });
    $('btn-expand-all').addEventListener('click', () => {
        cardsContainer.querySelectorAll('.config-card').forEach(c => c.classList.remove('collapsed'));
    });

    // Panel resizer
    setupResizer();

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveConfig();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            publish();
        }
    });
}

// ============================================================
// RESIZER
// ============================================================
function setupResizer() {
    const resizer = $('panel-resizer');
    const panel = $('cards-panel');
    let startX, startWidth;

    resizer.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (e) => {
            const diff = e.clientX - startX;
            const newWidth = Math.max(300, Math.min(600, startWidth + diff));
            panel.style.width = newWidth + 'px';
        };
        const onUp = () => {
            resizer.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ============================================================
// UI HELPERS
// ============================================================
let saveTimeout;
function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveConfig(), 800);
}

function flashSaveStatus(status) {
    saveStatus.classList.add('visible');
    if (status === 'saving') {
        saveStatus.className = 'status-indicator visible';
        saveStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
    } else if (status === 'saved') {
        saveStatus.className = 'status-indicator visible';
        saveStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> 已保存';
        setTimeout(() => saveStatus.classList.remove('visible'), 2000);
    } else if (status === 'error') {
        saveStatus.className = 'status-indicator visible error';
        saveStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> 保存失败';
    }
}

function showToast(message, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${esc(message)}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// START
// ============================================================
init();
