# Context Map

This monorepo has two independently installable plugin contexts.

| Context | Path | Responsibility |
| --- | --- | --- |
| Qwen Token Plan Responses provider | `packages/qwen-token-plan-cn-responses/` | Qwen Token Plan CN model routing, Responses/Chat wire adaptation, catalog snapshots, and server-side Harness activity. |
| ServerChan notifier | `packages/serverchan-notify/` | Non-blocking ServerChan3 notification at top-level turn completion. |

Cross-package architectural decisions belong in `docs/adr/`. Package-specific glossaries and ADRs are created lazily inside the corresponding package.
