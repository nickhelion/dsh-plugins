# Token Plan Responses 模型目录与推理档位研究

- 调研时间：2026-08-21（Asia/Shanghai）
- 调研对象：`dsh-qwen-token-plan-cn-responses` 的个人版文本模型目录
- 证据范围：千问官方文档、千问个人版第一方 API、参考 Pi 扩展的源代码与提交历史
- 安全说明：探测从本机 DSH credential store 在内存中读取凭据；脚本、输出和本文均未记录或打印 API Key。

## 结论

1. **目录不应在插件运行时抓文档。** 应由仓库里的定时 CI 每天读取官方文档和第一方 API，生成候选快照并开 PR；测试和人工审查通过后再发新版 npm 包。已安装的同一版本必须始终使用包内静态快照。
2. Pi 扩展最终也选择了**静态、随版本发布的模型表**，而不是运行时发现；但它靠人工维护，且 2026-08-05 得出的“DeepSeek/GLM 不支持 Responses”在 2026-08-21 已过时。因此应借鉴其“静态运行时”结论，不应照搬其目录内容或纯人工流程。
3. 官方 Responses schema 在传输层接受七个值：`none | minimal | low | medium | high | xhigh | max`，默认值写作 `xhigh`；但官方 Chat 文档又为部分模型给出了更窄的**语义档位及别名映射**。目录必须分别记录“线上接受值”和“对用户有意义的独立档位”，不能把“HTTP 200”自动解释为“独立推理强度”。
4. 个人版当前八个文本模型中，除 `glm-5.2` 外，七档均被第一方 Responses 端点接受，`none` 确实关闭推理。`glm-5.2` 当前存在**仅限 Responses 嵌套参数路径**的网关兼容问题：显式 `reasoning.effort=high/xhigh/max` 均返回 HTTP 400；`none/minimal/low/medium` 可调用。后续跨协议探测证明 Chat 与 Anthropic 端点可以传递 GLM 档位，因此不能把这个 400 解释成模型本身不支持推理强度。
5. 给 DSH 模型选择器的稳妥策略：
   - Qwen 3.8：优先展示官方模型级语义档位 `low / medium / xhigh`，默认 `xhigh`；其余值虽被 Responses 接受，但模型级映射没有公开说明。
   - Qwen 3.7/3.6：Responses 七档均接受；官方只明确“默认开启思考”，未给这三个模型单独的 effort 映射。可以展示 Responses 的六个非关闭档位，但文案必须标注“Responses 通用档位”，不能伪造 token-budget 映射。
   - `deepseek-v4-pro`：展示 `high / max`，默认 `high`；`low/medium → high`，`xhigh → max`。
   - `deepseek-v4-pro-0813`、`deepseek-v4-flash-0731`：展示 `low / high / max`，默认 `high`；`medium/xhigh → high`。
   - `glm-5.2`：在厂商修复前不要把会直接 400 的 `high/max` 作为可发送选项。省略参数可正常使用默认思考；若要提供实验档位，只能把实测可调用的 `minimal/low/medium` 标为“兼容性临时值”，不能声称它们等价于官方的 `high/max`。

## 1. 官方目录与 API 契约

### 1.1 个人版八个文本模型

[Token Plan 个人版概览](https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview) 当前列出以下可文本生成模型：

- `qwen3.8-max`
- `qwen3.7-max`
- `qwen3.7-plus`
- `qwen3.6-flash`
- `glm-5.2`
- `deepseek-v4-pro`
- `deepseek-v4-pro-0813`
- `deepseek-v4-flash-0731`

同一页面还列出音频、图片和视频模型；它们不属于 DSH 文本 LLM adapter 的目录。

[OpenAI Responses API 参考](https://platform.qianwenai.com/docs/api-reference/chat/openai-responses) 的 `model` 清单也包含以上八个 ID。该页对 `reasoning.effort` 的通用契约是：默认 `xhigh`，可选 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`，并称其为七个递增档位。该页同时说明未在文档中列出的 OpenAI 参数可能被忽略，因此目录检查器应以这份 Responses 文档而不是 OpenAI 原始规范为准。

[思考模式指南](https://platform.qianwenai.com/docs/developer-guides/text-generation/thinking) 明确：上述 Qwen 3.8、Qwen 3.7、Qwen 3.6、DeepSeek V4 和 GLM 5.2 都是混合思考模型且默认开启。该指南也明确 `thinking_budget` 暂不适用于 Responses API，因此 DSH 的 Responses adapter 不应通过 `thinking_budget` 模拟 UI 档位。

### 1.2 模型级语义档位

[OpenAI Chat API 参考](https://platform.qianwenai.com/docs/api-reference/chat/openai-chat) 给出的模型级 `reasoning_effort` 规则比 Responses schema 更窄：

| 模型族 | 官方独立档位 | 默认 | 官方别名映射 |
|---|---|---|---|
| `qwen3.8-max` | `low / medium / xhigh` | `xhigh` | 文档未说明其他 Responses 值如何映射 |
| `deepseek-v4-pro` | `high / max` | `high`（参数级默认） | `low/medium → high`，`xhigh → max` |
| `glm-5.2` | `high / max` | `high`（参数级默认） | `low/medium → high`，`xhigh → max` |
| `deepseek-v4-pro-0813` | `low / high / max` | `high` | `medium/xhigh → high` |
| `deepseek-v4-flash-0731` | `low / high / max` | `high` | `medium/xhigh → high` |

Qwen 3.7 与 Qwen 3.6 没有在该参数段落中获得单独映射；它们的模型指南主要以 `thinking_budget` 控制推理深度，而该参数又不适用于 Responses。因此对这三个模型只能采用 Responses 通用七档契约并持续实测，不能从 Chat 的 token budget 自行推导数值映射。

> 注意：同一厂商的 Anthropic、Chat、Responses 三种传输协议可能给出不同默认值或别名规则。这里只将 Chat 文档用于识别模型级语义，最终可发送性必须由 Token Plan **Responses** 端点验证。

## 2. 第一方 API 探测

### 2.1 方法

目标端点：

```text
POST https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/responses
```

对八个模型分别发送：

1. 不带 `reasoning`；
2. `reasoning.effort` 依次为七个 schema 值；
3. 固定短文本输入、不启用内置工具、`store: false`；
4. 记录 HTTP 状态、响应状态、输出项类型和 usage 中的 reasoning token 数；不保存响应正文；
5. 第一轮用较小 `max_output_tokens` 降低探测消耗；`glm-5.2` 的失败项又在**完全不传** `max_output_tokens` 的情况下复测，结果不变；
6. 另用明显非法值验证服务器确实校验 effort，而不是静默忽略：Qwen 和 DeepSeek 均返回 HTTP 400，并列出七个合法值。

这是一轮协议兼容性探测。它能证明“接受/拒绝”“是否关闭推理”，但单个短 prompt 的 reasoning token 数具有随机性，**不能证明两个被接受档位在模型内部是否完全等价**。映射结论只采用官方文档明示内容。

图例：

- `R`：HTTP 200，返回 reasoning 输出项；
- `O`：HTTP 200，仅有普通消息，reasoning tokens 为 0；
- `E`：HTTP 400；
- “省略”表示不发送 `reasoning` 对象。

### 2.2 结果矩阵

| 模型 | 省略 | `none` | `minimal` | `low` | `medium` | `high` | `xhigh` | `max` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `qwen3.8-max` | R | O | R | R | R | R | R | R |
| `qwen3.7-max` | R | O | R | R | R | R | R | R |
| `qwen3.7-plus` | R | O | R | R | R | R | R | R |
| `qwen3.6-flash` | R | O | R | R | R | R | R | R |
| `glm-5.2` | R | O | R | R | R | **E** | **E** | **E** |
| `deepseek-v4-pro` | R | O | R | R | R | R | R | R |
| `deepseek-v4-pro-0813` | R | O | R | R | R | R | R | R |
| `deepseek-v4-flash-0731` | R | O | R | R | R | R | R | R |

`glm-5.2` 三个失败值的错误一致：后端称 `thinking_budget` 必须为正整数且不得大于 131072。请求没有发送 `thinking_budget`，复测也没有发送 `max_output_tokens`，因此这是服务端将 Responses effort 转换为内部 budget 时的兼容性问题，而不是本插件拼包错误。

### 2.3 GLM-5.2 跨协议复测

同日依据最新官方模型页、Chat API 与 Anthropic API 文档，对 Token Plan 个人版的同一个 `glm-5.2` 又做了协议分层探测。请求均为交互式短题，只记录状态、错误码、输出项类型与 token usage，不记录正文或凭据。

| 协议与字段 | 实测可传值 | 实测拒绝值 | 结论 |
|---|---|---|---|
| Responses：`reasoning.effort` | `none/minimal/low/medium` | `high/xhigh/max` | 高三档被网关错误映射成超过 131072 的内部 budget |
| OpenAI Chat：顶层 `reasoning_effort` | 七档全部 HTTP 200 | 非法枚举值 | `none` 实测关闭思考；模型级独立语义仍按官方映射收敛为关闭 / high / max |
| Anthropic：`output_config.effort` | `low/medium/high/xhigh/max` | `none/minimal` 与非法枚举值 | 关闭思考应使用 `thinking.type=disabled`；其余值按官方别名映射 |

附加边界结果：

- Chat 的显式 `thinking_budget=4096` 成功，`131073` 被明确拒绝；由于 `max_completion_tokens` 还必须严格大于 budget 且自身最大值为 131072，当前网关的实际可用上界是 131071，`131072` 会撞到两个约束的交界错误。
- Responses 虽然会接受未记录在该协议参考中的顶层 `enable_thinking` 与 `thinking_budget`，并且 `enable_thinking=false`、`thinking_budget=16/32` 实测生效，但官方思考指南明确称 Responses 暂不支持 `thinking_budget`。插件不能依赖这种未公开兼容行为。
- Responses 顶层 `reasoning_effort` 请求也返回 HTTP 200，但 `none` 在中等推理题上仍产生了 reasoning，说明该字段不能作为可靠替代；正确的 Responses 标准字段仍是嵌套的 `reasoning.effort`。

[智谱官方核心参数](https://docs.bigmodel.cn/cn/guide/start/concept-param) 解释了“七个可传枚举”和“独立语义档位”的差别：GLM-5.2 的 `none/minimal` 都关闭思考，`low/medium` 映射到 `high`，`xhigh` 映射到 `max`，默认 `max`。千问的通用 Chat/Anthropic 参考也把 GLM 收敛为 `high/max` 两个开启档位，但参数级默认值存在 `high` 与 `max` 的文档差异。因此目录应展示**关闭 / high / max**，并把默认值按具体协议记录，不能展示七个看似独立的强度。

[阿里云 GLM-5.2 模型页](https://help.aliyun.com/zh/model-studio/glm-5-2) 当前列出的上下文长度、最大输出和最大思维链长度分别为 1048576、131072、131072。仓库中的 `maxTokens=16384` 目前是 DSH 请求的保守默认输出上限，不应误写成模型能力上限；若以后改名或拆字段，应分别表达“模型硬上限”和“插件默认请求上限”。

对本插件的直接含义：当前保持 GLM-5.2 的 Responses 推理选择器隐藏是正确的止损措施。若要安全恢复 `关闭/high/max`，应为 GLM 增加协议级路由（Chat 或 Anthropic）并复用 DSH 工具，而不是把未公开的 Responses `thinking_budget` 当长期 API，或把 `minimal/low/medium` 冒充三个独立档位。

### 2.4 `/models` 不能单独作为目录权威

2026-08-21 实测 `GET /compatible-mode/v1/models` 已从 Pi 在 2026-08-05 观察到的 401 变为 HTTP 200，但返回的 11 个 ID 中没有 `deepseek-v4-pro-0813`；该模型却同时出现在个人版文档和 Responses 文档中，并且 POST 实测成功。

因此 CI 可把 `/models` 当作**漂移信号**，但不能只取它与个人版文档的交集，否则会错误删除可用模型。建议候选集合为：

```text
个人版文本模型 ∩ Responses 文档模型
```

再以 POST smoke probe 标注“当前可调用”；`/models` 只作为额外证据和异常提示。

## 3. Pi 扩展如何做

参考实现：[`shamiao/pi-extension-qwen-token-plan-cn-ex`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex)，审阅固定提交 `776d316648cf2858bfe3d38b9566f0c6f67b5a62`，避免分支后续变化影响结论。

### 3.1 最终实现是随版本发布的静态目录

[`lib/models.ts`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/blob/776d316648cf2858bfe3d38b9566f0c6f67b5a62/lib/models.ts#L1-L160) 内直接维护 `MODEL_REGISTRY`，并明确“新模型通过扩展列表并发布新版加入”。[`index.ts`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/blob/776d316648cf2858bfe3d38b9566f0c6f67b5a62/index.ts#L35-L54) 注册 provider 时直接使用这个静态数组，没有在用户启动时抓官方网页。

提交历史显示它曾实现 `GET /models` + 自动探测，但因当时 Token Plan key 对 `/models` 返回 401 而停止接入运行时刷新：

- [`9daf64b5`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/commit/9daf64b532f659f9de81f74ea0eff1331320546f)：改为 static-only；
- [`bc429677`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/commit/bc429677f1913447dc3815b9cfdbb13e1be3db2d)：移除目录发现/自动画像代码和探测记录。

这个选择保证了同一 npm 版本可复现，但没有每日 CI 或自动 PR，更新仍靠维护者手工编辑。

### 3.2 推理档位处理

Pi 的 [`FULL_THINKING_LEVEL_MAP`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/blob/776d316648cf2858bfe3d38b9566f0c6f67b5a62/lib/models.ts#L34-L47) 将 Pi 的七个级别一一映射到 Responses 的七个 effort，模型表中的五个 Qwen 模型共用该 map；预览模型单独把关闭设为 `null`。

请求构造器 [`lib/qwen-responses-params.ts`](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/blob/776d316648cf2858bfe3d38b9566f0c6f67b5a62/lib/qwen-responses-params.ts#L75-L125) 通过 Pi 的 `clampThinkingLevel` 选取可用级别，然后原样发送 `reasoning: { effort }`。它还为 Qwen 3.8 单独扩大 `max_output_tokens` ceiling，避免高推理 budget 大于输出上限导致 400。

### 3.3 可借鉴与不可照搬

可借鉴：

- 用户运行时只读静态目录；目录变更通过版本发布交付；
- effort 使用显式 per-model map，而不是一个模糊的 `reasoning: true/false`；
- 新能力在收录前做第一方 API smoke probe；
- 输出总预算与推理预算的约束应单独测试。

不可照搬：

- 它在 2026-08-05 实测 DeepSeek/GLM 不支持 Responses，因而只保留五个 Qwen；到 2026-08-21，第一方端点已支持本文的 DeepSeek/GLM 模型，说明手工目录会快速过时；
- 它对 Qwen 模型统一使用 identity map，但只详尽探测过 `qwen3.8-max`；不能把“一个模型接受七档”外推为所有模型的独立语义；
- 它的 `qwen3.8-max-preview` 已被官方个人版页面标记为下线并路由到正式版，不能继续作为新的独立目录项；
- `/models` 现在虽可访问，却仍会漏掉可 POST 调用的 `deepseek-v4-pro-0813`，不能重新退回纯 API discovery。

## 4. 推荐的每日同步与发布流水线

### 4.1 数据模型

生成的静态 catalog 应把以下事实分开保存：

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": {
    "default": "high",
    "semanticEfforts": ["high", "max"],
    "acceptedWireEfforts": ["none", "minimal", "low", "medium", "high", "xhigh", "max"],
    "aliases": {
      "low": "high",
      "medium": "high",
      "xhigh": "max"
    },
    "transport": "responses",
    "verifiedAt": "2026-08-21T17:36:51+08:00"
  }
}
```

其中：

- `semanticEfforts` 决定模型选择器展示哪些互不重复的档位；
- `acceptedWireEfforts` 用于兼容性测试和诊断，不应全都显示；
- `aliases` 防止 UI 出现多个实际相同的选择；
- `verifiedAt` 是构建产物的证据时间，不是运行时联网刷新时间。

### 4.2 每日任务

1. 定时获取官方 Markdown：个人版模型页、Responses API、Chat API、思考模式、内置工具页；
2. 解析 `个人版文本模型 ∩ Responses 文档模型`；
3. 查询 `/models`，只用于发现新增/缺失差异；
4. 对新增模型和能力变化做低成本 POST 探测；完整七档矩阵只对变化项或定期（例如每周）执行，避免浪费 Credits；
5. 将候选 catalog 与仓库快照比较；无差异则结束；
6. 有差异时生成报告和 PR，CI 校验 schema、单元测试、包内容和 secret scan；
7. 人工确认官方语义与异常（尤其 GLM 这类文档/API 冲突）；
8. 合并后走现有 package tag + npm OIDC 发布流程。

### 4.3 失败策略

- 任一官方文档解析失败：不开 PR、不改发布目录；
- POST 暂时 429/5xx：标记 inconclusive，不删除现有模型；
- 文档新增但 smoke 失败：PR 中记录候选，默认不暴露；
- 文档移除但旧模型仍可调用：先标记 deprecated，至少经过一次人工审查再删除；
- 文档与 API 冲突：保留最近可用静态快照，在 PR 中阻塞自动发布；
- CI 和探测日志只能保存模型 ID、HTTP 状态、错误码与经过截断/脱敏的错误信息，绝不保存 Authorization header 或凭据。

## 5. 调研发现与本次改造

1. `glm-5.2` 的 `high/xhigh/max` 会返回 400；本次快照已暂时隐藏其推理控件，并保留接受/拒绝证据供后续复测。
2. 原运行时 `CatalogManager` 每六小时抓官方 Markdown；本次已改成包内只读快照，网络抓取迁移到每日仓库工作流。
3. 原解析器混淆“模型语义”和“传输层接受值”；本次目录已分别保存语义档位、接受/拒绝值与别名映射。
4. Pi 参考实现证明纯手工静态表会快速过时；本次采用“**构建时自动提 PR、审查后发版、运行时完全静态**”。

## 来源

- [Token Plan 个人版概览](https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview)
- [OpenAI Responses API 参考](https://platform.qianwenai.com/docs/api-reference/chat/openai-responses)
- [OpenAI Chat API 参考](https://platform.qianwenai.com/docs/api-reference/chat/openai-chat)
- [思考模式指南](https://platform.qianwenai.com/docs/developer-guides/text-generation/thinking)
- [Anthropic Messages API 参考](https://platform.qianwenai.com/docs/api-reference/chat/anthropic)
- [GLM-5.2 模型信息（阿里云）](https://help.aliyun.com/zh/model-studio/glm-5-2)
- [GLM 核心参数（智谱官方）](https://docs.bigmodel.cn/cn/guide/start/concept-param)
- [Pi 包目录页](https://pi.dev/packages/pi-extension-qwen-token-plan-cn-ex?name=web&page=6)
- [Pi 扩展源代码（固定提交）](https://github.com/shamiao/pi-extension-qwen-token-plan-cn-ex/tree/776d316648cf2858bfe3d38b9566f0c6f67b5a62)
