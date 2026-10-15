# Working on Project Atlas

Read README.md. Keep the runtime dependency-free and Node 24+. Personal data, paths, Codex IDs, caches and generated personal HTML belong in ignored `.local/`. Only synthetic examples may be committed or deployed. Never stage an entire parent workspace.

Ordinary refresh: run `node src/cli.mjs refresh`, inspect its short JSON result, and return `.local/index.html`. Do not read or summarize all conversations again. Personalization: prefer `.local/config.json`, `.local/context.json` and `custom/` overrides. For summaries or progress, use `.agents/skills/project-atlas/SKILL.md`.

Changing parsers, data contracts or generation requires `npm test`. Preserve old output on source or validation failure. Do not treat a discussion, prepared material, implemented code, tests or deployment as the same progress state. Do not create scheduled AI jobs unless requested.
