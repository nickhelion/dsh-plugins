import { BUNDLED_CATALOG, CatalogSnapshot } from "./catalog.js";
import { normalizeHarnessMode } from "./harness.js";
import { QwenTokenPlanResponsesAdapter } from "./adapter.js";

export const name = "qwen-token-plan-cn-responses";
export const inject = ["llm"];

/** Cordis 插件入口。注册独立路由，不覆盖现有 Anthropic Token Plan 提供方。 */
export function apply(ctx, config = {}) {
  const providerId = config.providerId || "qwen-token-plan-cn-responses";
  const catalog = new CatalogSnapshot();
  const adapter = new QwenTokenPlanResponsesAdapter({
    ctx,
    catalog,
    providerId,
    displayName: config.displayName || "Qwen Token Plan 个人版（Responses + 内置工具）",
    apiKeyEnv: config.apiKeyEnv || "QWEN_TOKEN_PLAN_CN_API_KEY",
    endpoint: config.endpoint || "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/responses",
    harnessMode: normalizeHarnessMode(config.harness),
  });
  const disposeRegistration = ctx.llm.registerAdapter([providerId], adapter);
  ctx.on?.("dispose", disposeRegistration);
  ctx.logger.info(`qwen-token-plan-cn-responses: 已注册 ${providerId}，使用随版本发布的静态模型目录`);
}

// Cordis loader 在存在 default export 时以函数对象本身读取注入声明。
apply.inject = inject;

export default apply;
export { BUNDLED_CATALOG, CatalogSnapshot, QwenTokenPlanResponsesAdapter };
