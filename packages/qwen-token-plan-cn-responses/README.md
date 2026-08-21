# DSH Qwen Token Plan CN Responses

[![CI](https://github.com/nickhelion/dsh-qwen-token-plan-cn-responses/actions/workflows/ci.yml/badge.svg)](https://github.com/nickhelion/dsh-qwen-token-plan-cn-responses/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dsh-qwen-token-plan-cn-responses.svg)](https://www.npmjs.com/package/dsh-qwen-token-plan-cn-responses)
[![npm downloads](https://img.shields.io/npm/dm/dsh-qwen-token-plan-cn-responses.svg)](https://www.npmjs.com/package/dsh-qwen-token-plan-cn-responses)
[![GitHub stars](https://img.shields.io/github/stars/nickhelion/dsh-qwen-token-plan-cn-responses?style=flat)](https://github.com/nickhelion/dsh-qwen-token-plan-cn-responses/stargazers)
[![Listed in Awesome DSH Plugins](https://img.shields.io/badge/listed-Awesome%20DSH%20Plugins-4c1)](https://github.com/vvlife/awesome-deepseek-harness-plugins#integrations--bridges)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 22.19+](https://img.shields.io/badge/Node.js-22.19%2B-339933)](https://nodejs.org/)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的千问 Token Plan 个人版 **Responses API Adapter**：自动跟踪官方模型目录，在模型选择器中明确标注服务端内置工具能力，同时保留 DSH 本地函数工具。

> 这是社区插件，不是阿里云、千问或 DeepSeek 官方项目。

## 为什么需要独立 Adapter

把普通提供方的 `api` 字段改成 `openai-responses` 还不够：通用适配器通常只序列化 `function` 工具，也只理解普通文本、推理和函数调用事件；千问的 `web_search_call`、`code_interpreter_call` 等服务端事件会被遗漏。

本插件在 DSH 官方 `LlmAdapter` Seam 上完成完整翻译：

```text
DSH messages/tools/images
        │
        ▼
Qwen Responses request ──► Token Plan endpoint
        ▲                         │
        │                         ▼
DSH StreamChunk ◄──────── Qwen Responses SSE
```

千问官方也明确说明：Harness 内置工具需要通过 Responses API 才会自动触发，Chat Completions 客户端不会自动调用这些工具。参见[接入 Harness 工具](https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools)。

## 功能

- 独立提供方：`qwen-token-plan-cn-responses`，不覆盖原有 Anthropic/Chat Completions 路线。
- 同时支持：
  - Qwen 服务端内置工具；
  - DSH 本地 `function` 工具；
  - 文本、推理、工具调用与工具结果多轮历史；
  - DSH 持久化图片附件。
- 启动时同步官方目录，之后默认每 6 小时刷新。
- ETag/Last-Modified 条件请求、完整校验、原子写入和 last-known-good 回退。
- 模型选择器直接显示“内置工具 5 项 / 3 项 / 仅 DSH 工具”。
- API Key 每次调用时从 DSH 凭据服务解析；插件配置、日志和目录缓存均不保存 Key。
- 把联网搜索来源、代码解释器活动等服务端工具信息显示为简洁的回复附录。

## 当前官方能力矩阵

以下是 **2026-08-20** 的官方文档同步结果。它只用于说明；运行时以模型选择器中的同步时间为准。

| 模型 | 输入 | 服务端内置工具 | DSH 本地函数工具 |
| --- | --- | --- | --- |
| `qwen3.8-max` | 文本、图片 | 联网搜索、代码解释器、网页抓取、文搜图、以图搜图 | 支持 |
| `qwen3.7-max` | 文本 | 联网搜索、代码解释器、网页抓取 | 支持 |
| `qwen3.7-plus` | 文本、图片 | 联网搜索、代码解释器、网页抓取、文搜图、以图搜图 | 支持 |
| `qwen3.6-flash` | 文本、图片 | 官方当前未列出 | 支持 |
| `glm-5.2` | 文本 | 官方当前未列出 | 支持 |
| `deepseek-v4-pro` | 文本 | 官方当前未列出 | 支持 |
| `deepseek-v4-pro-0813` | 文本 | 官方当前未列出 | 支持 |
| `deepseek-v4-flash-0731` | 文本 | 官方当前未列出 | 支持 |

这里的“官方未列出”只否定**服务端内置工具**，不影响模型通过 Responses `function_call` 使用 DSH 本地工具。个人版完整模型名单见[官方概述](https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview)。

### 图片搜索工具命名

Responses schema 中：

- `web_search_image` 接收文本 `queries`，对应**文搜图**；
- `image_search` 接收输入图片索引与 `bbox`，对应**以图搜图**。

插件按协议参数语义显示中文名，而不是照抄第三方静态列表。

## 安装

### 前置条件

- DeepSeek Harness `0.1.0-rc.6` 或更新的 `0.1.x`；
- Node.js 22.19 或更高版本；
- Token Plan 个人版 API Key；
- DSH profile（以下以 `web` 为例）。

### 从 npm 安装（推荐）

一条命令安装到 `web` profile：

```bash
dsh plugin --profile web add dsh-qwen-token-plan-cn-responses
```

如果没有全局 `dsh` 命令：

```bash
npx @deepseek-ai/dsh plugin --profile web add dsh-qwen-token-plan-cn-responses
```

然后重启对应 DSH 进程。插件自带 bundle patch，会注册默认提供方，无需手工复制模型列表或填写上下文参数。

升级：

```bash
dsh plugin --profile web up dsh-qwen-token-plan-cn-responses@latest
```

卸载：

```bash
dsh plugin --profile web remove dsh-qwen-token-plan-cn-responses
```

### 固定版本或从 GitHub 安装

生产环境建议固定版本：

```bash
dsh plugin --profile web add dsh-qwen-token-plan-cn-responses@0.1.1
```

也可直接安装 GitHub 分支或 commit：

```bash
dsh plugin --profile web add github:nickhelion/dsh-qwen-token-plan-cn-responses#main
```

如需本地开发安装：

```bash
git clone https://github.com/nickhelion/dsh-qwen-token-plan-cn-responses.git
cd dsh-qwen-token-plan-cn-responses
npm install
dsh plugin --profile web add "$PWD"
```

## 凭据：只保存一次

默认凭据引用是：

```text
QWEN_TOKEN_PLAN_CN_API_KEY
```

如果现有 DSH `qwen-token-plan-cn` 提供方已经使用这个引用，插件会直接复用，**不会要求再填一遍 Token**。

全新安装可通过 DSH 凭据/模型设置界面保存该引用，或在启动 DSH 的进程环境中提供同名变量。不要把 Key 写进 `cordis.patch.yml`、仓库文件或命令历史。

## 使用

打开 DSH 模型选择器，选择提供方：

```text
Qwen Token Plan 个人版（Responses + 内置工具）
```

再选择带能力标记的模型，例如：

```text
qwen3.8-max（内置工具 5 项）
```

模型会自动决定是否使用已声明的服务端工具。Harness 工具按成功调用次数消耗 Credits，具体以[官方说明](https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools#费用说明)为准。

## 配置

插件 bundle 的默认配置：

```yaml
- insert:
    - id: qwen-token-plan-cn-responses
      name: dsh-qwen-token-plan-cn-responses
      config:
        providerId: qwen-token-plan-cn-responses
        apiKeyEnv: QWEN_TOKEN_PLAN_CN_API_KEY
        harness: auto
        catalogRefreshMs: 21600000
```

可以在 profile 或 `$DSH_HOME/cordis.patch.yml` 中按同一 entry id 覆盖配置。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `providerId` | `qwen-token-plan-cn-responses` | DSH 路由 ID。 |
| `displayName` | `Qwen Token Plan 个人版（Responses + 内置工具）` | 选择器名称。 |
| `apiKeyEnv` | `QWEN_TOKEN_PLAN_CN_API_KEY` | DSH 凭据引用名。 |
| `endpoint` | Token Plan 北京 Responses 地址 | 一般无需修改。 |
| `harness` | `auto` | 服务端工具策略。 |
| `catalogRefreshMs` | `21600000` | 官方目录刷新周期；设为 `0` 可关闭周期刷新。 |
| `catalogTimeoutMs` | `30000` | 每份官方文档的请求超时。 |
| `catalogCacheFile` | `$DSH_HOME/cache/.../catalog.json` | last-known-good 缓存位置。 |

`harness` 支持：

- `auto`：启用该模型官方列出的全部内置工具；
- `none`：不声明服务端内置工具；
- 逗号字符串或数组：启用配置集合与模型官方能力的交集。

可用协议工具名：`web_search`、`code_interpreter`、`web_extractor`、`web_search_image`、`image_search`。选择 `web_extractor` 时会自动补上平台要求的 `web_search`。

## 官方目录同步

模型集合按以下规则生成：

```text
个人版中具备“文本生成”的模型 ∩ Responses API 支持模型
```

然后从 OpenClaw 官方示例补充 context window、max tokens、图片输入和推理参数，再从 Harness 文档的**个人版**表格补充逐模型工具能力。四份文档全部成功解析后才会替换目录；任何请求或格式异常都会保留现有快照。

详见 [`docs/CATALOG-SYNC.md`](docs/CATALOG-SYNC.md)。

## 验证与开发

```bash
npm ci
npm run check

# 只验证当前官方文档能否解析；不读取 API Key，不调用模型
npm run test:live-catalog

# 检查未来发布包会包含什么
npm pack --dry-run
```

确定性测试不访问网络，也不需要 Token。架构说明见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)；Agent 开始修改前请阅读 [`AGENTS.md`](AGENTS.md)。

### 给 Agent 的最短路径

```text
1. Read AGENTS.md.
2. Run npm ci && npm run check.
3. Keep credentials as references; never read or commit real keys.
4. Change pure parsers/codecs behind their existing seams and add fixtures.
5. Run npm pack --dry-run before proposing a release.
```

## 排障

### `MISSING_CREDENTIAL`

DSH 未能解析 `apiKeyEnv` 指向的凭据。确认 Key 存在于**启动 DSH 的服务环境或 DSH 凭据服务**，而不只是当前交互式 shell。

### 模型列表仍是旧的

重启会立即触发刷新，也可检查缓存快照中的 `syncedAt`。插件遇到官方文档不可达或格式变化时会故意保留 last-known-good，不会展示半份目录。

### 模型没有调用内置工具

确认：

1. 选择的是本插件的 Responses 提供方，而非原 Anthropic 路线；
2. 模型名称不是“仅 DSH 工具”；
3. `harness` 不是 `none`；
4. Prompt 确实需要该工具——`auto` 不保证每次都调用。

### `web_extractor` 未生效

平台要求它与 `web_search` 一同声明。插件会自动补齐；若仍失败，请附上已脱敏的错误事件开 Issue。

## 安全与隐私

- 不要提交 `.credentials.yaml`、`.env`、目录缓存或真实对话日志。
- 插件不会把 Key 发往官方文档站点。
- Token Plan 个人版有使用范围、数据授权和单设备等条款，使用前请阅读[官方订阅前须知](https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview#订阅前须知)。
- 漏洞请按 [`SECURITY.md`](SECURITY.md) 私下报告。

## 致谢

协议行为参考并交叉验证了 MIT 许可的 [`pi-extension-qwen-token-plan-cn-ex`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex)，但本项目拥有独立的 DSH Adapter、官方文档同步、缓存和流转换实现。详情见 [`NOTICE`](NOTICE)。

本插件已被 [`awesome-deepseek-harness-plugins`](https://github.com/vvlife/awesome-deepseek-harness-plugins#integrations--bridges) 收录；仓库同时使用官方建议的 [`dsh-plugin`](https://github.com/topics/dsh-plugin) Topic，供社区目录自动发现。

## License

[MIT](LICENSE)
