/**
 * MoeWah · 简历编辑器（独立于主页编辑器，避免重构主页编辑器带来的回归风险）
 * 架构与主页编辑器一致：parse → render cards → edit → debounced save → iframe preview (/resume)
 * 数据源：src/resume.js（window.RESUME_CONFIG = {...}）
 */

// ============================================================
// PARSE / SERIALIZE
// ============================================================
function parseFullConfig(raw) {
    const marker = 'window.RESUME_CONFIG = ';
    const idx = raw.indexOf(marker);
    if (idx === -1) return {};
    const braceStart = raw.indexOf('{', idx);
    if (braceStart === -1) return {};
    let depth = 0, endIdx = -1, inStr = false, strCh = '';
    for (let i = braceStart; i < raw.length; i++) {
        const ch = raw[i];
        if (!inStr) {
            if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; }
            else if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
        } else {
            if (ch === strCh && raw[i - 1] !== '\\') { inStr = false; strCh = ''; }
        }
    }
    if (endIdx === -1) return {};
    try { return new Function('return ' + raw.substring(braceStart, endIdx + 1))(); }
    catch (e) { console.error('parse error:', e.message); return {}; }
}

function serializeValue(v, indent) {
    const pad = '    '.repeat(indent);
    const padInner = '    '.repeat(indent + 1);
    if (v === null) return 'null';
    if (v === undefined) return 'null';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) {
        if (v.length === 0) return '[]';
        const items = v.map(it => padInner + serializeValue(it, indent + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    if (typeof v === 'object') {
        const keys = Object.keys(v);
        if (keys.length === 0) return '{}';
        const lines = keys.map(k => padInner + escKey(k) + ': ' + serializeValue(v[k], indent + 1));
        return '{\n' + lines.join(',\n') + '\n' + pad + '}';
    }
    return JSON.stringify(v);
}
function escKey(k) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k); }

function serializeConfig(obj) {
    return '/**\n * 杨晨旭简历数据（由编辑器自动写入）\n */\n\nwindow.RESUME_CONFIG = ' + serializeValue(obj, 1) + ';\n';
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
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// CARD DEFINITIONS
// ============================================================
const RESUME_CARD_DEFS = [
    {
        id: 'basics', icon: 'fa-id-card', color: '#00d4ff',
        title: '基础信息',
        fields: [
            { label: '姓名', key: 'basics.name', type: 'text' },
            { label: '标题', key: 'basics.title', type: 'text', placeholder: '如：人工智能 · 本科在读' },
            { label: '学校', key: 'basics.school', type: 'text' },
            { label: '头像路径', key: 'basics.avatar', type: 'text', placeholder: 'images/resume-portrait.jpg' },
            { label: 'MBTI', key: 'basics.mbti', type: 'text' },
        ],
        sections: [{
            label: '联系方式', itemsKey: 'contacts', addLabel: '一条',
            fields: [
                { key: 'type', label: '类型', type: 'select', options: [
                    { v: 'phone', l: '电话' },
                    { v: 'email', l: '邮箱' },
                    { v: 'website', l: '个人网站' },
                    { v: 'github', l: 'GitHub' },
                    { v: 'wechat', l: '微信' },
                    { v: 'linkedin', l: 'LinkedIn' },
                    { v: 'twitter', l: 'Twitter' },
                    { v: 'bilibili', l: 'Bilibili' },
                    { v: 'blog', l: '博客' },
                    { v: 'other', l: '其他' },
                ] },
                { key: 'value', label: '值', type: 'text' },
            ]
        }]
    },
    {
        id: 'education', icon: 'fa-graduation-cap', color: '#b066ff',
        title: '教育经历',
        sections: [{
            label: '教育条目', itemsKey: 'education', addLabel: '一条',
            fields: [
                { key: 'school', label: '学校', type: 'text' },
                { key: 'major', label: '专业', type: 'text' },
                { key: 'degree', label: '学历', type: 'text' },
                { key: 'gpa', label: 'GPA', type: 'text' },
                { key: 'period', label: '时间', type: 'text', placeholder: '2022.09 – 2026.06' },
            ]
        }]
    },
    {
        id: 'skills', icon: 'fa-screwdriver-wrench', color: '#27c93f',
        title: '专业技能',
        sections: [{
            label: '技能条目', itemsKey: 'skills', addLabel: '一项',
            fields: [
                { key: 'category', label: '分类', type: 'text' },
                { key: 'description', label: '描述', type: 'textarea' },
            ]
        }]
    },
    {
        id: 'publications', icon: 'fa-flask', color: '#ff9500',
        title: '科研经历',
        sections: [{
            label: '论文/科研', itemsKey: 'publications', addLabel: '一项',
            fields: [
                { key: 'title', label: '标题', type: 'text' },
                { key: 'abbrev', label: '简称', type: 'text', placeholder: '如 ViDAL-Net' },
                { key: 'venue', label: '会议/期刊', type: 'text' },
                { key: 'period', label: '时间', type: 'text' },
                { key: 'role', label: '承担工作', type: 'text' },
                { key: 'highlights', label: '亮点（每行一项）', type: 'list' },
            ]
        }]
    },
    {
        id: 'openSource', icon: 'fa-brands fa-github', color: '#58a6ff',
        title: '开源经历',
        sections: [{
            label: '开源项目', itemsKey: 'openSource', addLabel: '一项',
            fields: [
                { key: 'name', label: '项目名', type: 'text' },
                { key: 'org', label: '组织', type: 'text' },
                { key: 'url', label: '链接', type: 'text' },
                { key: 'role', label: '角色', type: 'text' },
                { key: 'impact', label: '影响力', type: 'text' },
                { key: 'period', label: '时间', type: 'text' },
                { key: 'description', label: '描述', type: 'textarea' },
            ]
        }]
    },
    {
        id: 'projects', icon: 'fa-folder-open', color: '#4a9eff',
        title: '项目经历',
        sections: [{
            label: '项目', itemsKey: 'projects', addLabel: '一项',
            fields: [
                { key: 'name', label: '名称', type: 'text' },
                { key: 'tag', label: '标签', type: 'text' },
                { key: 'period', label: '时间', type: 'text' },
                { key: 'role', label: '角色', type: 'text' },
                { key: 'impact', label: '影响力', type: 'text' },
                { key: 'description', label: '描述', type: 'textarea' },
            ]
        }]
    },
    {
        id: 'awards', icon: 'fa-trophy', color: '#ffc107',
        title: '科技竞赛',
        sections: [{
            label: '奖项', itemsKey: 'awards', addLabel: '一项',
            fields: [
                { key: 'name', label: '赛事', type: 'text' },
                { key: 'level', label: '等级', type: 'text' },
                { key: 'date', label: '时间', type: 'text' },
            ]
        }]
    },
];

// ============================================================
// BADGE
// ============================================================
function computeBadge(def) {
    if (def.sections) {
        for (const sec of def.sections) {
            if (sec.itemsKey) {
                const n = (cfg[sec.itemsKey] || []).length;
                return n > 0 ? `${n} 项` : '空';
            }
        }
    }
    return '';
}

// ============================================================
// FIELD BUILDERS
// ============================================================
function textHTML(label, key, value, opts) {
    const inputType = key === 'basics.avatar' || key.endsWith('.url') || key === 'basics.github' || key === 'basics.website' ? 'url' : 'text';
    return `<div class="field-group">
        <label class="field-label">${esc(label)}</label>
        <input type="${inputType}" data-key="${key}" value="${esc(value)}" placeholder="${esc(opts?.placeholder || '')}">
    </div>`;
}

function objectListSectionHTML(sec) {
    const items = cfg[sec.itemsKey] || [];
    let itemsHTML = '';
    items.forEach((item, i) => {
        let fieldsHTML = '';
        for (const f of sec.fields) {
            const v = item[f.key];
            const dataPath = `${sec.itemsKey}.${f.key}.${i}`;
            let inputHTML;
            if (f.type === 'textarea') {
                inputHTML = `<textarea data-obj="${dataPath}" rows="3" placeholder="${esc(f.placeholder || '')}">${esc(String(v != null ? v : ''))}</textarea>`;
            } else if (f.type === 'list') {
                const arr = Array.isArray(v) ? v : [];
                inputHTML = `<textarea data-obj-list="${dataPath}" rows="4" placeholder="${esc(f.placeholder || '每行一项')}">${esc(arr.join('\n'))}</textarea>`;
            } else if (f.type === 'select') {
                const opts = (f.options || []).map(o =>
                    `<option value="${esc(o.v)}" ${o.v === v ? 'selected' : ''}>${esc(o.l)}</option>`
                ).join('');
                inputHTML = `<select data-obj="${dataPath}"><option value="">-- 选择 --</option>${opts}</select>`;
            } else {
                inputHTML = `<input type="text" data-obj="${dataPath}" value="${esc(String(v != null ? v : ''))}" placeholder="${esc(f.placeholder || '')}">`;
            }
            fieldsHTML += `<div class="field-group">
                <label class="field-label">${esc(f.label)}</label>
                ${inputHTML}
            </div>`;
        }
        itemsHTML += `<div class="obj-item" data-obj-idx="${i}">
            <div class="obj-item-head">
                <span class="obj-item-num">#${i + 1}</span>
                <button class="btn-icon btn-icon-danger" data-obj-remove="${sec.itemsKey}:${i}" title="删除"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            ${fieldsHTML}
        </div>`;
    });
    return `<div class="field-group">
        <label class="field-label">${esc(sec.label)} (${items.length})</label>
        <div class="obj-list" data-obj-key="${sec.itemsKey}">${itemsHTML}</div>
        <button class="btn-add" data-obj-add="${sec.itemsKey}"><i class="fa-solid fa-plus"></i> 添加${esc(sec.addLabel || '一项')}</button>
    </div>`;
}

// ============================================================
// RENDER CARDS
// ============================================================
let cfg = {};
let bodyHTML = '';
function renderCards() {
    bodyHTML = '';
    const container = $('cards-container');
    container.innerHTML = '';
    for (const def of RESUME_CARD_DEFS) {
        const cardEl = createCard(def);
        container.appendChild(cardEl);
    }
}

function createCard(def) {
    const el = document.createElement('div');
    el.className = 'config-card';
    const badge = computeBadge(def);
    let cardBody = '';
    if (def.fields) {
        for (const f of def.fields) cardBody += textHTML(f.label, f.key, getVal(f.key), f);
    }
    if (def.sections) {
        for (const sec of def.sections) cardBody += objectListSectionHTML(sec);
    }
    // 卡片头部小加号：折叠时也可点，给第一个 section 添加条目
    const firstSection = def.sections && def.sections[0];
    const inlineAdd = firstSection ? `<button class="card-quick-add" data-quick-add="${firstSection.itemsKey}" title="快速添加"><i class="fa-solid fa-plus"></i></button>` : '';
    el.innerHTML = `
        <div class="card-header">
            <div class="card-header-left">
                <div class="card-icon" style="background:${def.color}18;color:${def.color}"><i class="fa-solid ${def.icon}"></i></div>
                <span class="card-title">${esc(def.title)}</span>
                ${badge ? `<span class="card-badge">${badge}</span>` : ''}
            </div>
            <div class="card-header-right">
                ${inlineAdd}
                <i class="fa-solid fa-chevron-down card-toggle"></i>
            </div>
        </div>
        <div class="card-body">${cardBody}</div>`;
    el.querySelector('.card-header').addEventListener('click', (e) => {
        // 防止小加号触发卡片折叠
        if (e.target.closest('.card-quick-add')) return;
        el.classList.toggle('collapsed');
    });
    // 卡片头部小加号：点 add 直接加
    const quickBtn = el.querySelector('.card-quick-add');
    if (quickBtn) {
        quickBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = quickBtn.dataset.quickAdd;
            if (!cfg[key]) cfg[key] = [];
            cfg[key].push({});
            renderCards();
            debouncedSave();
        });
    }
    bindCardEvents(el);
    return el;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindCardEvents(cardEl) {
    cardEl.querySelectorAll('input[data-key], textarea[data-key]').forEach(el => {
        el.addEventListener('input', () => setVal(el.dataset.key, el.value));
    });

    cardEl.querySelectorAll('input[data-obj], textarea[data-obj], select[data-obj]').forEach(el => {
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => {
            const [itemsKey, fieldKey, idx] = el.dataset.obj.split('.');
            const i = parseInt(idx);
            if (!cfg[itemsKey]) cfg[itemsKey] = [];
            if (!cfg[itemsKey][i]) cfg[itemsKey][i] = {};
            cfg[itemsKey][i][fieldKey] = el.value;
            debouncedSave();
        });
    });

    cardEl.querySelectorAll('textarea[data-obj-list]').forEach(el => {
        el.addEventListener('input', () => {
            const [itemsKey, fieldKey, idx] = el.dataset.objList.split('.');
            const i = parseInt(idx);
            const lines = el.value.split('\n').filter(s => s.trim() !== '');
            if (!cfg[itemsKey]) cfg[itemsKey] = [];
            if (!cfg[itemsKey][i]) cfg[itemsKey][i] = {};
            cfg[itemsKey][i][fieldKey] = lines;
            debouncedSave();
        });
    });

    cardEl.querySelectorAll('[data-obj-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            const [key, idx] = btn.dataset.objRemove.split(':');
            if (cfg[key]) { cfg[key].splice(parseInt(idx), 1); renderCards(); debouncedSave(); }
        });
    });

    cardEl.querySelectorAll('[data-obj-add]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const key = btn.dataset.objAdd;
            if (!cfg[key]) cfg[key] = [];
            cfg[key].push({});
            renderCards();
            debouncedSave();
        });
    });
}

// ============================================================
// PREVIEW
// ============================================================
function loadPreviewInPane(refresh = false) {
    const wrap = $('preview-frame-wrap');
    const placeholder = $('preview-placeholder');
    const url = '/resume' + (refresh || cfg.__loaded ? '?t=' + Date.now() : '');
    wrap.querySelector('#preview-iframe').src = url;
    $('preview-url').textContent = 'localhost:3000' + url;
    wrap.classList.remove('hidden');
    placeholder.classList.add('hidden');
    cfg.__loaded = true;
    // 同时刷新源码
    refreshConfigSource();
}

function refreshConfigSource() {
    $('config-code').textContent = serializeConfig(cfg);
}

async function refreshPreview() {
    try {
        const res = await apiFetch('/api/build', { method: 'POST' });
        if (res && res.success) {
            showToast('已重建 dist/resume/', 'success');
            loadPreviewInPane(true);
        } else {
            showToast('构建失败：' + (res?.error || ''), 'error');
        }
    } catch (e) { /* serverDead */ }
}

// ============================================================
// SAVE
// ============================================================
let saveTimer = null;
function debouncedSave() {
    clearTimeout(saveTimer);
    $('save-status').innerHTML = '<i class="fa-solid fa-spinner"></i> 保存中...';
    saveTimer = setTimeout(saveConfig, 500);
}
async function saveConfig() {
    try {
        const res = await apiFetch('/api/resume-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: serializeConfig(cfg) })
        });
        if (res && res.success) {
            $('save-status').innerHTML = '<i class="fa-solid fa-circle-check"></i> 已保存';
            refreshConfigSource();
        }
    } catch (e) { /* serverDead */ }
}

// ============================================================
// API + BANNER
// ============================================================
let serverDead = false;
async function apiFetch(url, opts) {
    try {
        const res = await fetch(url, opts);
        if (serverDead) hideServerBanner();
        return res.headers.get('content-type')?.includes('json') ? res.json() : res;
    } catch (e) {
        showServerBanner();
        throw e;
    }
}
function showServerBanner() {
    serverDead = true;
    const b = $('server-banner'); if (b) b.classList.remove('hidden');
    showToast('编辑器服务已停止', 'error');
}
function hideServerBanner() {
    serverDead = false;
    const b = $('server-banner'); if (b) b.classList.add('hidden');
}

// ============================================================
// TOAST / MODAL
// ============================================================
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}"></i> ${esc(msg)}`;
    $('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ============================================================
// HELPERS
// ============================================================
function $(id) { return document.getElementById(id); }

// ============================================================
// INIT
// ============================================================
async function init() {
    try {
        const res = await apiFetch('/api/resume-config');
        const raw = res.content;
        cfg = parseFullConfig(raw);
    } catch (e) {
        showToast('加载简历配置失败', 'error');
        cfg = {};
    }
    renderCards();
    loadPreviewInPane();
    setupEvents();
}

function setupEvents() {
    $('btn-back-home').addEventListener('click', () => { window.location.href = '/editor'; });
    $('btn-save').addEventListener('click', saveConfig);
    $('btn-build').addEventListener('click', refreshPreview);
    $('btn-refresh-preview').addEventListener('click', () => loadPreviewInPane(true));
    $('btn-close-preview').addEventListener('click', () => {
        $('preview-frame-wrap').classList.add('hidden');
        $('preview-placeholder').classList.remove('hidden');
        $('preview-iframe').src = 'about:blank';
    });
    $('btn-open-new-tab').addEventListener('click', () => window.open('/resume', '_blank'));

    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const view = tab.dataset.view;
            if (view === 'preview') {
                $('preview-frame-wrap').classList.remove('hidden');
                $('preview-placeholder').classList.add('hidden');
                $('config-source').classList.add('hidden');
                loadPreviewInPane(true);
            } else {
                $('preview-frame-wrap').classList.add('hidden');
                $('preview-placeholder').classList.add('hidden');
                $('config-source').classList.remove('hidden');
                refreshConfigSource();
            }
        });
    });

    $('btn-collapse-all').addEventListener('click', () => document.querySelectorAll('.config-card').forEach(c => c.classList.add('collapsed')));
    $('btn-expand-all').addEventListener('click', () => document.querySelectorAll('.config-card').forEach(c => c.classList.remove('collapsed')));
}

init();