#!/usr/bin/env node
/**
 * MoeWah 一键发布脚本
 * 执行流程：构建 → 提交 → 推送
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function logStep(step, msg) {
    console.log(`\n${CYAN}${BOLD}[${step}]${RESET} ${msg}`);
}

function logSuccess(msg) {
    console.log(`${GREEN}✓${RESET} ${msg}`);
}

function logWarn(msg) {
    console.log(`${YELLOW}!${RESET} ${msg}`);
}

function logError(msg) {
    console.log(`${RED}✗${RESET} ${msg}`);
}

function run(cmd, opts = {}) {
    console.log(`  ${YELLOW}$ ${cmd}${RESET}`);
    try {
        const output = execSync(cmd, {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            stdio: opts.silent ? 'pipe' : 'inherit',
            ...opts,
        });
        if (opts.silent && output) {
            return output.trim();
        }
        return output ? output.trim() : '';
    } catch (err) {
        if (opts.allowFail) return '';
        throw new Error(`Command failed: ${cmd}\n${err.message}`);
    }
}

function generateCommitMessage() {
    const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
    return `update: ${timestamp}`;
}

async function main() {
    console.log(`\n${BOLD}${'═'.repeat(50)}${RESET}`);
    console.log(`${BOLD}  🚀 MoeWah 一键发布${RESET}`);
    console.log(`${BOLD}${'═'.repeat(50)}${RESET}`);

    // Check git repo
    logStep('0/3', '检查 Git 仓库...');
    try {
        const repo = run('git remote get-url origin', { silent: true });
        logSuccess(`远程仓库: ${repo}`);
    } catch {
        logError('未检测到 Git 远程仓库，请先配置 git remote');
        process.exit(1);
    }

    // Step 1: Build
    logStep('1/3', '构建静态页面...');
    try {
        run('npm run build', { stdio: 'inherit' });
        if (!fs.existsSync(DIST_DIR)) {
            throw new Error('构建完成但未找到 dist/ 目录');
        }
        logSuccess('构建完成');
    } catch (err) {
        logError(`构建失败: ${err.message}`);
        process.exit(1);
    }

    // Step 2: Commit
    logStep('2/3', '提交变更...');
    const statusOutput = run('git status --short', { silent: true });
    if (!statusOutput) {
        logWarn('没有检测到变更，跳过提交');
    } else {
        run('git add -A');
        const message = generateCommitMessage();
        try {
            run(`git commit -m "${message}"`, { stdio: 'inherit' });
            logSuccess(`已提交: "${message}"`);
        } catch (err) {
            logWarn('提交失败（可能没有变更需要提交），继续推送...');
        }
    }

    // Step 3: Push
    logStep('3/3', '推送到 GitHub...');
    try {
        run('git push', { stdio: 'inherit' });
        logSuccess('推送完成');
    } catch (err) {
        logError(`推送失败: ${err.message}`);
        process.exit(1);
    }

    console.log(`\n${BOLD}${'═'.repeat(50)}${RESET}`);
    console.log(`${GREEN}${BOLD}  🎉 发布成功！${RESET}`);
    console.log(`${BOLD}${'═'.repeat(50)}${RESET}\n`);
}

main().catch(err => {
    logError(err.message);
    process.exit(1);
});
