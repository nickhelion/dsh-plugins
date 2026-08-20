export const DOCS = {
  personal: `# Token Plan 个人版
这里是用于测试的官方文档摘录，保留真实章节和表格结构。${"说明".repeat(80)}
## 支持的模型
| 品牌 | 模型 ID（Model ID） | 模型能力 |
| --- | --- | --- |
| 千问 | qwen3.8-max | 推理模型、视觉理解、文本生成 |
| 千问 | qwen3.7-max | 推理模型、文本生成 |
| DeepSeek | deepseek-v4-pro-0813 | 推理模型、文本生成 |
| 千问 | qwen-image | 图片生成 |
## 支持的 Harness 工具
略
`,
  tools: `# 接入 Harness 工具
${"工具说明".repeat(60)}
## 支持的模型和工具
### 个人版
| 模型 | 支持的工具 |
| --- | --- |
| qwen3.8-max | 联网搜索、代码解释器、网页抓取、以图搜图、文搜图 |
| qwen3.7-max | 联网搜索、代码解释器、网页抓取 |
### 团队版
| 模型 | 支持的工具 |
| --- | --- |
| qwen3.8-max | 联网搜索 |
`,
  openclaw: `# OpenClaw
${"配置说明".repeat(50)}
\`\`\`json
{
  "models": { "providers": { "bailian-token-plan": { "models": [
    { "id": "qwen3.8-max", "reasoning": true, "input": ["text", "image"], "contextWindow": 983616, "maxTokens": 131072 },
    { "id": "qwen3.7-max", "reasoning": false, "input": ["text"], "contextWindow": 1000000, "maxTokens": 65536 },
    { "id": "deepseek-v4-pro-0813", "reasoning": false, "input": ["text"], "contextWindow": 163840, "maxTokens": 32768 }
  ] } } }
}
\`\`\`
`,
  responses: `# 创建响应
${"Responses API 说明".repeat(30)}
openapi: 3.1.0
components:
  schemas:
    Request:
      properties:
        model:
          type: string
          description: 模型名称。支持的模型包括 qwen3.8-max、qwen3.7-max、deepseek-v4-pro-0813、qwen3.6-flash。
`,
};

export function sseResponse(events, status = 200) {
  const body = `${events.map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}
