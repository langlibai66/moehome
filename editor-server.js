#!/usr/bin/env node
/**
 * MoeWah Editor Server
 * 提供可视化编辑器界面和预览服务
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;

// Resolve PROJECT_ROOT robustly:
// When run as `node editor-server.js`, __dirname = <root>/editor
// But if the CWD differs (e.g. browser preview), we search upward
// from __dirname to find the directory that contains the editor/ folder.
function findProjectRoot() {
    // Start from the directory containing THIS file
    let dir = __dirname;
    // If we're already inside an editor/ subdirectory, go up one level
    if (path.basename(dir) === 'editor') {
        dir = path.resolve(dir, '..');
    }
    // Verify it has the editor/ folder
    const candidate = path.join(dir, 'editor');
    if (fs.existsSync(candidate)) {
        return dir;
    }
    // Fallback: walk up until we find editor/ or hit the root
    let prev = null;
    while (dir !== prev) {
        if (fs.existsSync(path.join(dir, 'editor'))) return dir;
        prev = dir;
        dir = path.resolve(dir, '..');
    }
    // Last resort: assume standard layout (project root is parent of editor/)
    return path.resolve(__dirname, '..');
}

const PROJECT_ROOT = findProjectRoot();
const EDITOR_DIR = path.join(PROJECT_ROOT, 'editor');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // ==================== API Routes ====================
    if (url.pathname === '/api/config' && req.method === 'GET') {
        try {
            const configPath = path.join(PROJECT_ROOT, 'src', 'config.js');
            const content = fs.readFileSync(configPath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (url.pathname === '/api/config' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { content } = JSON.parse(body);
                const configPath = path.join(PROJECT_ROOT, 'src', 'config.js');
                fs.writeFileSync(configPath, content, 'utf8');
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, message: '配置已保存' }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (url.pathname === '/api/build' && req.method === 'POST') {
        try {
            const output = execSync('npm run build', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 60000,
            });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, output: output.trim() }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: err.stdout || err.message }));
        }
        return;
    }

    if (url.pathname === '/api/publish' && req.method === 'POST') {
        try {
            const output = execSync('node publish.js', {
                cwd: PROJECT_ROOT,
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 120000,
            });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, output: output.trim() }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: err.stdout || err.message }));
        }
        return;
    }

    // ==================== Static File Serving ====================

    // Editor routes
    if (url.pathname === '/editor' || url.pathname === '/editor/') {
        serveFile(res, path.join(EDITOR_DIR, 'editor.html'));
        return;
    }

    if (url.pathname.startsWith('/editor/')) {
        const filePath = path.join(EDITOR_DIR, url.pathname.replace('/editor/', ''));
        serveFile(res, filePath);
        return;
    }

    // Preview routes: serve from dist/
    let filePath = path.join(PROJECT_ROOT, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);

    // If not found in dist, try project root (for images etc.)
    if (!fs.existsSync(filePath)) {
        filePath = path.join(PROJECT_ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
    }

    // If still not found, try editor/ directory (for editor assets)
    if (!fs.existsSync(filePath)) {
        filePath = path.join(EDITOR_DIR, url.pathname === '/' ? 'editor.html' : url.pathname.replace(/^\/+/, ''));
    }

    serveFile(res, filePath);
});

function serveFile(res, filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            // For directories, try index.html
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
                serveFile(res, indexPath);
                return;
            }
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        res.writeHead(404);
        res.end('Not Found');
    }
}

server.listen(PORT, () => {
    console.log(`\n🚀 MoeWah Editor Server`);
    console.log(`   📝 编辑器: http://localhost:${PORT}/editor`);
    console.log(`   👁  预览:   http://localhost:${PORT}/\n`);
});
