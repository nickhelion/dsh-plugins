# Domain Docs

This repository uses a multi-context domain model.

## Before exploring

1. Read root `CONTEXT-MAP.md`.
2. Read the `CONTEXT.md` for the package being changed, when it exists.
3. Read relevant ADRs from root `docs/adr/` and the package's `docs/adr/`.
4. Missing glossary or ADR files are created lazily by `/domain-modeling`; do not invent empty domain content during setup.

## Layout

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                                  # cross-package decisions
└── packages/
    ├── qwen-token-plan-cn-responses/
    │   ├── CONTEXT.md
    │   └── docs/adr/                          # Qwen-provider decisions
    └── serverchan-notify/
        ├── CONTEXT.md
        └── docs/adr/                          # ServerChan decisions
```

Use glossary vocabulary in issue titles, specs, tests, and code. Surface any proposed change that contradicts an existing ADR.
