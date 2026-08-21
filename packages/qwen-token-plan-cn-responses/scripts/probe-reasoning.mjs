const key = process.env.QWEN_TOKEN_PLAN_CN_API_KEY;
if (!key) throw new Error("set QWEN_TOKEN_PLAN_CN_API_KEY in the local process environment");

const models = process.argv.slice(2);
if (!models.length) throw new Error("usage: npm run reasoning:probe --workspace dsh-qwen-token-plan-cn-responses -- <model> [model...]");
const efforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const endpoint = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/responses";

for (const model of models) {
  const results = [];
  for (const effort of efforts) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: "只回复 OK", reasoning: { effort }, max_output_tokens: 64, store: false }),
    });
    if (response.ok) {
      const body = await response.json();
      results.push({ effort, status: response.status, reasoningTokens: body.usage?.output_tokens_details?.reasoning_tokens ?? 0 });
    } else {
      const body = await response.json().catch(() => ({}));
      results.push({ effort, status: response.status, error: body?.error?.code ?? "rejected" });
    }
  }
  console.log(JSON.stringify({ model, results }));
}
