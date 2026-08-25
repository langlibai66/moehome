#!/usr/bin/env node
/**
 * MoeWah Editor Server
 * 可视化编辑器开发服务器 + API + 预览
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const PORT = parseInt(process.env.EDITOR_PORT || process.env.PORT || '3000', 10);

// Auto-find available port
function findAvailablePort(start) {
    const net = require('net');
    return new Promise(resolve => {
        const s = net.createServer();
        s.listen(start, () => { const p = s.address().port; s.close(() => resolve(p)); });
        s.on('error', () => resolve(findAvailablePort(start + 1)));
    });
}

// Resolve project root from this file's location
const EDITOR_DIR = path.join(__dirname, 'editor');
const PROJECT_ROOT = path.resolve(EDITOR_DIR, '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

async function main() {
    const port = await findAvailablePort(PORT);
    if (port !== PORT) console.log(`   ⚠️  端口 ${PORT} 被占用，使用 ${port}`);

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        const url = new URL(req.url, `http://localhost:${port}`);

        // API: GET config
        if (url.pathname === '/api/config' && req.method === 'GET') {
            try {
                const content = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'config.js'), 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ content }));
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // API: POST config
        if (url.pathname === '/api/config' && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const { content } = JSON.parse(body);
                    fs.writeFileSync(path.join(PROJECT_ROOT, 'src', 'config.js'), content, 'utf8');
                    res.writeHead(200); res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // API: POST upload avatar
        if (url.pathname === '/api/upload-avatar' && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const { dataUrl } = JSON.parse(body);
                    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
                    if (!matches) throw new Error('Invalid data URL');
                    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                    const imagesDir = path.join(PROJECT_ROOT, 'images');
                    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
                    const avatarPath = path.join(imagesDir, 'avatar.' + ext);
                    fs.writeFileSync(avatarPath, Buffer.from(matches[2], 'base64'));
                    res.writeHead(200); res.end(JSON.stringify({ success: true, path: '/images/avatar.' + ext }));
                } catch (e) {
                    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // API: POST backup config (create a backup before save)
        if (url.pathname === '/api/backup' && req.method === 'POST') {
            try {
                const configPath = path.join(PROJECT_ROOT, 'src', 'config.js');
                const backupDir = path.join(PROJECT_ROOT, '.editor-backups');
                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const backupPath = path.join(backupDir, `config-${timestamp}.js`);
                fs.copyFileSync(configPath, backupPath);
                // Keep only last 10 backups
                const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('config-')).sort().reverse();
                backups.slice(10).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
                res.writeHead(200); res.end(JSON.stringify({ success: true, backup: backupPath }));
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // API: GET list backups
        if (url.pathname === '/api/backups' && req.method === 'GET') {
            try {
                const backupDir = path.join(PROJECT_ROOT, '.editor-backups');
                if (!fs.existsSync(backupDir)) { res.writeHead(200); res.end(JSON.stringify({ backups: [] })); return; }
                const backups = fs.readdirSync(backupDir)
                    .filter(f => f.startsWith('config-') && f.endsWith('.js'))
                    .sort()
                    .reverse()
                    .map(f => {
                        const stat = fs.statSync(path.join(backupDir, f));
                        return { name: f, time: stat.mtime.toISOString(), size: stat.size };
                    });
                res.writeHead(200); res.end(JSON.stringify({ backups }));
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // API: POST restore backup
        if (url.pathname === '/api/restore' && req.method === 'POST') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const { name } = JSON.parse(body);
                    const backupPath = path.join(PROJECT_ROOT, '.editor-backups', name);
                    const configPath = path.join(PROJECT_ROOT, 'src', 'config.js');
                    if (!fs.existsSync(backupPath)) throw new Error('Backup not found');
                    fs.copyFileSync(backupPath, configPath);
                    res.writeHead(200); res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
                }
            });
            return;
        }

        // API: POST reset config to original (from git HEAD)
        if (url.pathname === '/api/reset' && req.method === 'POST') {
            try {
                const configPath = path.join(PROJECT_ROOT, 'src', 'config.js');
                const originalContent = execSync('git show HEAD:src/config.js', {
                    cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'pipe'
                });
                if (originalContent && originalContent.includes('HOMEPAGE_CONFIG')) {
                    fs.writeFileSync(configPath, originalContent, 'utf8');
                    res.writeHead(200); res.end(JSON.stringify({ success: true, message: '已恢复为初始配置' }));
                } else {
                    throw new Error('无法从 git 恢复配置');
                }
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }

        // API: build
        if (url.pathname === '/api/build' && req.method === 'POST') {
            try {
                const out = execSync('npm run build', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 60000 });
                res.writeHead(200); res.end(JSON.stringify({ success: true, output: out.trim() }));
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.stdout || e.message }));
            }
            return;
        }

        // API: publish
        if (url.pathname === '/api/publish' && req.method === 'POST') {
            try {
                const out = execSync('node publish.js', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 120000 });
                res.writeHead(200); res.end(JSON.stringify({ success: true, output: out.trim() }));
            } catch (e) {
                res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.stdout || e.message }));
            }
            return;
        }

        // Static: editor routes
        if (url.pathname === '/editor' || url.pathname === '/editor/') {
            serve(res, path.join(EDITOR_DIR, 'editor.html'));
            return;
        }
        if (url.pathname.startsWith('/editor/')) {
            serve(res, path.join(EDITOR_DIR, url.pathname.replace('/editor/', '')));
            return;
        }

        // Static: preview (dist/ or project root)
        let fp = path.join(PROJECT_ROOT, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);
        if (!fs.existsSync(fp)) fp = path.join(PROJECT_ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
        if (!fs.existsSync(fp)) fp = path.join(EDITOR_DIR, url.pathname === '/' ? 'editor.html' : url.pathname.replace(/^\/+/, ''));
        serve(res, fp);
    });

    server.listen(port, () => {
        const editorUrl = `http://localhost:${port}/editor`;
        console.log(`\n🚀 MoeWah Editor Server`);
        console.log(`   📝 编辑器: ${editorUrl}`);
        console.log(`   👁  预览:   http://localhost:${port}/\n`);
        // 自动打开浏览器（设 EDITOR_NO_OPEN=1 可关闭）
        if (!process.env.EDITOR_NO_OPEN) {
            if (process.platform === 'win32') {
                exec(`start "" "${editorUrl}"`);
            } else if (process.platform === 'darwin') {
                exec(`open "${editorUrl}"`);
            } else {
                exec(`xdg-open "${editorUrl}"`);
            }
        }
    });
}

function serve(res, filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            const idx = path.join(filePath, 'index.html');
            if (fs.existsSync(idx)) { serve(res, idx); return; }
            res.writeHead(404); res.end('Not Found'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(filePath));
    } catch {
        res.writeHead(404); res.end('Not Found');
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
