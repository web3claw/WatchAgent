# WatchAgent — 多平台兼职任务监控 & 自动签到

基于 **eve 框架** + **Next.js** 构建的智能任务监控代理，自动抓取多个外包平台的新任务，通过 AI 分析后推送到 Telegram。

## 功能概览

| 功能 | 说明 |
|---|---|
| 🕵️ 猿急送监控 | 抓取 yuanjisong.com 最新兼职任务 |
| 🕷️ 互站网监控 | 抓取 task.huzhan.com 最新外包任务 |
| 🎯 R5威客监控 | 抓取 r5.cn 最新威客任务 |
| 🤖 AI 分析 | 每个新任务自动分析技术难度、预算合理性、推荐指数 |
| 📱 Telegram 推送 | 新任务实时推送到 Telegram |
| ☁️ 69yun69 签到 | 每日自动签到获取流量 |
| 🔄 去重机制 | Redis 存储已见任务，只推送新任务 |
| ⏰ 定时任务 | 每天北京时间 8:00 自动执行 |
| 🌐 手动触发 | 浏览器访问 API 即可手动执行 |

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | [eve](https://eve.dev) — 文件系统优先的持久化 AI 代理框架 |
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 |
| AI 模型 | mimo-v2.5-pro（小米 MiMo 代理） |
| 抓取 | Firecrawl API（猿急送）、原生 fetch（互站网、R5） |
| 存储 | Upstash Redis（Vercel KV） |
| 通知 | Telegram Bot API |
| 部署 | Vercel Serverless |
| 语言 | TypeScript |

## 项目结构

```
watchagent/
├── agent/                          # eve 代理配置
│   ├── agent.ts                    # 代理运行时配置（模型、上下文窗口）
│   ├── instructions.md             # 代理系统提示词
│   ├── channels/
│   │   └── eve.ts                  # HTTP 频道配置（认证策略）
│   ├── tools/
│   │   ├── fetch_jobs.ts           # 猿急送职位抓取工具
│   │   ├── fetch_job_detail.ts     # 职位详情抓取工具
│   │   ├── manage_seen_jobs.ts     # Redis 去重管理工具
│   │   └── send_telegram.ts        # Telegram 发送工具
│   └── schedules/
│       ├── job_monitor.ts          # 猿急送定时任务
│       └── huzhan_monitor.ts       # 互站网定时任务
├── app/
│   ├── api/
│   │   ├── trigger/route.ts        # 猿急送手动触发 API
│   │   ├── trigger-huzhan/route.ts # 互站网手动触发 API
│   │   ├── trigger-r5/route.ts     # R5威客手动触发 API
│   │   └── checkin/route.ts        # 69yun69 自动签到 API
│   ├── page.tsx                    # Web Chat 首页
│   └── layout.tsx                  # 布局
├── components/                     # UI 组件（AI Elements + shadcn/ui）
└── lib/                            # 工具函数
```

## API 接口

所有接口均为 GET 请求，浏览器直接访问即可触发。

| 接口 | 功能 | Redis Key |
|---|---|---|
| `/api/trigger` | 猿急送任务监控 | `yuanjisong:seen_jobs` |
| `/api/trigger-huzhan` | 互站网任务监控 | `huzhan:seen_jobs` |
| `/api/trigger-r5` | R5威客任务监控 | `r5:seen_jobs` |
| `/api/checkin` | 69yun69 每日签到 | — |

### 响应格式

```json
{
  "ok": true,
  "totalJobs": 20,
  "newJobs": 3,
  "results": [
    { "id": "159708", "title": "任务标题", "status": "sent" }
  ]
}
```

无新任务时：
```json
{ "ok": true, "message": "No new jobs", "totalJobs": 20, "newJobs": 0 }
```

## 环境变量

在 [Vercel 项目设置](https://vercel.com) 中配置：

| 变量 | 必需 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | AI 模型 API Key |
| `FIRECRAWL_API_KEY` | ✅ | Firecrawl 抓取服务 Key |
| `KV_REST_API_URL` | ✅ | Upstash Redis URL（Vercel 集成自动注入） |
| `KV_REST_API_TOKEN` | ✅ | Upstash Redis Token（Vercel 集成自动注入） |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot Token（@BotFather 获取） |
| `TELEGRAM_CHAT_ID` | ✅ | Telegram 目标聊天 ID |
| `YUN69_EMAIL` | 可选 | 69yun69 账号邮箱 |
| `YUN69_PASSWORD` | 可选 | 69yun69 账号密码 |

## 部署

### 前置条件

- Node.js 24+
- Vercel 账户
- Telegram Bot（通过 @BotFather 创建）
- Firecrawl API Key（https://firecrawl.dev）
- Upstash Redis（通过 Vercel Marketplace 安装）

### 部署步骤

```bash
# 1. 克隆项目
git clone <repo-url>
cd watchagent

# 2. 安装依赖
npm install

# 3. 本地开发
npm run dev          # Next.js 开发服务器
npm exec -- eve dev  # eve 代理 REPL（交互式）

# 4. 类型检查
npm run typecheck

# 5. 部署到 Vercel
vercel deploy --prod
```

### 本地测试

```bash
# 启动开发服务器
npm run dev

# 测试 API（需要设置环境变量）
curl http://localhost:3000/api/trigger
curl http://localhost:3000/api/trigger-huzhan
curl http://localhost:3000/api/trigger-r5
curl http://localhost:3000/api/checkin
```

## 工作流程

```
┌─────────────────────────────────────────────────────────┐
│                    定时触发 / 手动触发                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  1. 抓取任务列表                                          │
│     - 猿急送：Firecrawl API（绕过 JS 反爬）                │
│     - 互站网：原生 fetch（无反爬）                          │
│     - R5威客：原生 fetch（无反爬）                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  2. 解析任务数据                                          │
│     - 提取：ID、标题、价格、工时、描述                       │
│     - 正则匹配 + HTML/Markdown 解析                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  3. Redis 去重                                           │
│     - 读取已见任务 ID 列表                                  │
│     - 比对找出新任务                                       │
│     - 更新 Redis 存储                                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  4. AI 分析（每个新任务）                                   │
│     - 技术难度评估                                        │
│     - 适合技术栈分析                                       │
│     - 预算合理性判断                                       │
│     - 风险提示                                           │
│     - 推荐指数 1-5 星                                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  5. Telegram 推送                                        │
│     - 格式化消息（标题、价格、AI 分析、链接）                  │
│     - 发送到指定 Chat ID                                  │
└─────────────────────────────────────────────────────────┘
```

## Telegram 消息示例

```
🆕 Android SDK 打包
📍 猿急送 | 💰 2500元 | ⏱ 5天
📋 项目制

技术难度：中等
适合：熟悉 ONNX Runtime + Java SDK 的开发者
预算：合理，5天 2500 元属于市场价
风险：需求描述清晰，风险较低
推荐：⭐⭐⭐⭐

🔗 https://www.yuanjisong.com/job/159721
```

## 定时任务

| 任务 | Cron | 时间（北京时间） |
|---|---|---|
| 猿急送监控 | `0 0 * * *` | 每天 8:00 |
| 互站网监控 | `0 0 * * *` | 每天 8:00 |
| 69yun69 签到 | `0 0 * * *` | 每天 8:00 |

> Vercel Hobby 账户限制 cron 每天最多运行一次。

## 反爬方案

| 网站 | 反爬机制 | 解决方案 |
|---|---|---|
| 猿急送 | TLS 指纹检测（JA3/JA4） | Firecrawl API（真实浏览器渲染） |
| 互站网 | 无 | 原生 fetch |
| R5威客 | 无 | 原生 fetch |

## 开发命令

```bash
npm run dev          # 启动 Next.js 开发服务器
npm run build        # 生产构建
npm run typecheck    # TypeScript 类型检查
npm exec -- eve dev  # eve 代理交互式 REPL
npm exec -- eve dev --no-ui  # eve 无头模式（后台运行）
```

## 依赖说明

| 包 | 用途 |
|---|---|
| `eve` | AI 代理框架 |
| `ai` | Vercel AI SDK |
| `@ai-sdk/anthropic` | Anthropic 模型提供商 |
| `next` | Web 框架 |
| `react` / `react-dom` | UI 库 |
| `zod` | 数据验证 |
| `tailwindcss` | CSS 框架 |

## License

MIT
