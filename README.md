# MoeHome 个人主页（杨晨旭定制版）

基于 [MoeWah/MoeHome](https://github.com/moewah/MoeHome) 定制的个人主页。
一句话架构：**本地可视化编辑器改配置 → 一键发布推 GitHub → Cloudflare Pages 自动构建上线**。

## 数据流

```
本地                                        GitHub                      Cloudflare Pages
┌──────────────────────────┐
│ 双击 start-editor.bat     │
│   ├─ 可视化编辑配置       │   git push (仅源码)        webhook 触发
│   ├─ 构建预览             │ ─────────────────→  langlibai66/moehome ──→ npm run build
│   └─ 一键发布             │                       (dist 不入库)             ↓
└──────────────────────────┘                                                  dist/ 全球 CDN
                                                                              ↓
                                                                    你的域名（HTTPS，自动证书）
```

## 日常工作流（就这 3 步）

1. **双击 `start-editor.bat`** → 浏览器自动打开 `http://localhost:3000/editor`
2. 左侧面板改配置（自动保存 + 自动备份，可随时回退）
3. 点 **「一键发布」** → 自动保存 → 构建 → commit → push，约 1 分钟后 Cloudflare 自动上线

## 命令

| 命令 | 作用 |
|------|------|
| `npm run editor` | 启动编辑器服务器（= 双击 bat） |
| `npm run build` | 构建静态站到 `dist/` |
| `npm run serve` | 本地预览 `dist/`（8080 端口） |
| `npm run publish` | 命令行一键发布（构建 + 提交 + 推送） |

## 目录结构

```
├── src/               源码（改配置就是改 src/config.js）
│   ├── config.js        ★ 全站配置：名字/链接/主题/板块开关
│   ├── app.js           主页交互逻辑
│   └── style.css        样式
├── editor/            可视化编辑器前端（editor-server.js 的界面）
├── scripts/           构建脚本（build.js / minify.js 等）
├── images/            图片资源（头像等）
├── templates/         页面模板
├── editor-server.js   编辑器服务器：读/写配置、构建、发布 API
├── publish.js         发布流水线：build → git add/commit → git push
├── start-editor.bat   双击启动编辑器
└── dist/             构建产物（gitignore，不进仓库，Cloudflare 端构建）
```

## Cloudflare Pages 部署（一次性配置）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选择 `langlibai66/moehome` 仓库
3. 构建配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **环境变量**: `NODE_VERSION` = `20`
4. **Save and Deploy**，得到 `https://xxx.pages.dev`

之后每次 `git push`（包括编辑器的「一键发布」）自动触发部署。

## 绑定自己的域名（一次性配置）

前提：域名 DNS 托管在 Cloudflare（注册商是阿里云/腾讯云/GoDaddy 均可）：

1. Cloudflare 控制台 **Add a Domain** → 输入域名 → 选 Free 套餐
2. 去注册商把 **Nameservers** 改成 Cloudflare 给的两个地址（如 `xxx.ns.cloudflare.com`）
3. 等待生效（几分钟到 24 小时）
4. 进入 Pages 项目 → **Custom domains** → **Set up a custom domain** → 输入域名
5. DNS 记录和 HTTPS 证书（Universal SSL）全自动，几分钟生效

建议 `example.com` 和 `www.example.com` 都添加。

## 常见问题

**Q：为什么不用 GitHub Pages？**
A：GitHub Pages 其实也支持自定义域名，不是不能用。但 MoeHome 是「源码构建型」项目——GitHub Pages 不执行构建，你得本地 build 后把 dist 推上去，仓库会混入产物。Cloudflare Pages 直接连 GitHub 自动构建（仓库只存源码），且免费不限带宽、DNS/CDN/证书一站式，个人站首选。

**Q：构建时 sharp 相关警告/失败？**
A：无害。sharp 只用于图片压缩，失败时自动回退为原图（构建不会中断）。本地首次 `npm install` 也可能遇到 sharp 下载慢，重试即可。

**Q：一键发布报 git 错误？**
A：`git push` 依赖 GitHub 凭证。首次在终端跑一次 `git push`，用 Git Credential Manager 登录一次即可记住。

**Q：改错了想回退？**
A：编辑器有「备份/回退/重置」按钮（`.editor-backups/` 存最近 10 份配置）；整体回退用 `git revert`。
