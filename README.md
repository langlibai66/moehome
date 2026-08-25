# langlibai66-homepage

**个人主页 · 可视化编辑 + 静态构建 + 自动部署**

一个写配置就能改主页的可视化编辑器 + 一键推到 GitHub + Cloudflare Pages 自动构建上线的全链路静态站点方案。

---

## 实现的功能

### 编辑器 (`editor/`)
- **可视化配置面板**：左侧卡片墙（站点名/SEO/链接/项目/贡献图/页脚…），所有可改项都是表单
- **双页面编辑器**：主页配置页 (`/editor`) + 简历配置页 (`/editor/resume`)，互相跳转
- **实时预览**：右侧 iframe 直接渲染当前 dist
- **自动保存 / 自动去重备份**：每次改动 600ms 防抖落盘；会话开始时自动创建快照（与最近备份相同则跳过）；最近 10 份回退快照
- **三种回退方式**：会话级备份回退、`git diff` 检测的发布版重置、手动备份恢复
- **卡片右上角小加号**：折叠状态下也可直接给对应 section 添加条目，无需展开

### 构建 (`scripts/build.js`)
- **HTML 模板 + 占位符替换**：`templates/*.template.html` 中的 `{{VAR}}` 在构建时换成 `src/config.js` + `src/resume.js` 的实际值
- **资源 URL 自适应**：`site.url` 为空时所有资源用相对路径（推荐）；填了则改绝对路径
- **JS/CSS/HTML 压缩**：`terser` + `lightningcss` + `html-minifier-terser`，默认全部开启，可用 `MINIFY=false` 关
- **图片压缩**：`sharp` 自动转 webp + 压缩；失败时无害 fallback
- **依赖解析安全**：`parseFullConfig` 用 brace-match + safe eval 读 `window.HOMEPAGE_CONFIG` / `window.RESUME_CONFIG`，不依赖脆弱的正则

### 主题系统 (`src/theme-data.js` + `src/theme-utils.js`)
- **Mode (light/dark) 与 Scheme (配色方案) 解耦**：每个模式独立选配色，互不干扰
- **内置 8 套配色方案**：默认浅色=冰川青(Nord)、默认暗色=摩卡色(Catppuccin)，其它可选
- **localStorage 持久化**：用户选的 mode + schemes 跨会话保留
- **内联 CSS 变量注入**：`<head>` 一段极小内联脚本在首屏渲染前计算主题色，避免 FOUC

### 主页 (`templates/index.template.html` + `src/app.js`)
- 玻璃卡片风格 / 终端打字机 / 链接磁贴 / 奖项 / 项目（GitHub API 拉取）/ 贡献图 / RSS / 动态（可选）/ 留言（可选）/ 友链

### 简历子页 (`templates/resume.template.html` + `src/resume.js`)
- 与主页风格一致的玻璃卡
- 联系方式支持多组（电话/邮箱/GitHub/微信/LinkedIn/Twitter/Bilibili/博客/其他），自动按类型渲染图标
- 邮箱点击复制（反爬虫：Base64 + 字符反转双重编码）

### 发布 (`publish.js` + Cloudflare Pages)
- `一键发布` = flushSave → `npm run build` → `git add/commit/push`
- Cloudflare Pages 监听 push，Webhook 触发自动构建（`npm run build` → `dist/`）
- `dist/` 已 gitignore，仓库始终只存源码

---

## 复现步骤

### 1. 准备
```bash
git clone <your-fork-url>
cd langlibai66-homepage
npm install
```

### 2. 本地起编辑器
```bash
npm run editor
# 浏览器自动打开 http://localhost:3000/editor
```
- 左侧改配置 → 自动保存到 `src/config.js`
- 右下「构建预览」把 dist 加载到右侧 iframe
- 「一键发布」= 保存 + 构建 + commit + push（需要先配 git 凭证）

### 3. 命令行快捷
| 命令 | 作用 |
|------|------|
| `npm run editor` | 启动可视化编辑器（推荐入口） |
| `npm run build` | 构建静态站到 `dist/` |
| `npm run serve` | `http-server` 预览 dist (8080) |
| `npm run publish` | 命令行一键发布（构建 + git push） |

### 4. 部署到 Cloudflare Pages
1. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择这个仓库
3. 构建配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables**: `NODE_VERSION` = `20`
4. **Save and Deploy**，得到 `xxx.pages.dev`

### 5. 绑定自定义域名
DNS 托管在 Cloudflare 的前提下：
1. Pages 项目 → **Custom domains** → **Set up a custom domain** → 输入域名
2. DNS 记录 + HTTPS 证书全自动，几分钟生效

---

## 目录结构

```
src/                  源码（所有可改配置在这里）
  config.js             ★ 全站配置
  resume.js             ★ 简历数据
  app.js                主页交互
  style.css             主页样式
  theme-data.js         配色方案（内置）
  theme-utils.js        主题管理器

editor/               可视化编辑器前端
  editor.html           主页编辑器
  editor.js
  resume.html           简历编辑器
  resume.js
  editor.css

templates/            页面模板（构建时填占位符）
  index.template.html     ★ 主页
  resume.template.html    ★ 简历子页
  partials/navbar.html    导航 + 主题下拉
  404.template.html
  guestbook.template.html
  moments.template.html

scripts/              构建/工具
  build.js               ★ 主构建脚本
  publish.js             ★ 发布（构建 + git push）
  minify.js              JS/CSS/HTML 压缩
  github-fetcher.js      拉 GitHub 项目
  contribution-fetcher.js 拉贡献图
  rss-parser.js

images/               图片资源（头像、ico 等）
editor-server.js      ★ 编辑器服务：读/写配置、构建、发布 API
start-editor.bat      双击启动编辑器（清 NODE_OPTIONS 后 npm run editor）
wrangler.jsonc        Cloudflare 部署配置（assets.directory="./dist"）
```

---

## 配置文件入口（最常改的）

| 文件 | 改什么 |
|------|--------|
| `src/config.js` | 站点名/标语/SEO/链接导航/GitHub 项目/主题默认 |
| `src/resume.js` | 简历条目 |
| `templates/index.template.html` | 主页布局调整 |
| `templates/resume.template.html` | 简历布局调整 |
| `src/theme-data.js` | 新增/调整配色方案 |

改完直接刷新编辑器页面即可看到。

---

## 已知边界

- **Node ≥ 20**（Cloudflare Pages 环境变量已锁 `NODE_VERSION=20`）
- **Windows**：`start-editor.bat` 已清空 `NODE_OPTIONS`，避免 `--use-system-ca` 导致 npm 崩溃
- **Sharp 警告**：图片压缩失败时无害 fallback，构建照常进行
- **中文 README 标点**：使用半角英文标点 + GB/T 7714 风格