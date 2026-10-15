# Codex Project Atlas

A lightweight, local-first project memory dashboard for Codex. Return after a break and see what each project is for, where it stopped, and what you discussed.

**项目卡片 → 分类与热力图 → 进度和谈话梗概。普通刷新零模型调用，AI 按需整理和定制。**

## Quick start / 开始使用

Install **Node.js 24+**. There are no runtime dependencies and no API key is required.

```sh
git clone https://github.com/skdnlunknown/codex-project-atlas.git
cd codex-project-atlas
node src/cli.mjs demo
```

Open `examples/index.html` to see fictional demo projects, or use [online fictional demo](https://skdnlunknown.github.io/codex-project-atlas/). To connect your own local Codex:

```sh
node src/cli.mjs init
node src/cli.mjs refresh
```

Open `.local/index.html` directly in your browser. Windows users can also double-click `refresh.cmd`. No web server, cloud upload or model call occurs. Refresh only reads Codex metadata/conversation files; it does not read every project file.

The adapter currently recognizes `.codex-global-state.json` and `state_5.sqlite` under `CODEX_HOME` / `~/.codex`. This is an **internal format**, which may change. If discovery is incomplete, configure explicit projects; if storage becomes incompatible, use the JSON import contract. Windows is tested; other platforms are not yet verified. Cloud-only conversations are not collected.

## Personalize with your AI / 用 AI 定制

Open this repository in Codex and ask, for example:

> 初始化我的项目首页。按课程、开发和兴趣分区；课程显示实际讲到的章节与小节，开发区分实现、验证和发布；兴趣不强设进度。超过 60 天未活跃的项目折叠。改成紧凑暗色布局。

The included `.agents/skills/project-atlas/SKILL.md` guides initialization, incremental summaries and customization. You can edit that Skill to match your preferences. If your assistant does not discover repository skills, ask it to read the file explicitly.

| Customize | Private file |
| --- | --- |
| Title, categories, timezone, inactivity rules | `.local/config.json` |
| Project purpose and dated progress | `.local/context.json` |
| Conversation synopses and coverage | `.local/summaries.json` |
| Colors, density, typography | `custom/theme.css` |
| Layout and new progress visualizations | `custom/template.html` |

Start a custom template by copying `defaults/template.html`. Preserve `/*__ATLAS_DATA__*/` and schema version 1. Core upgrades leave `.local/` and `custom/` intact. These are trusted local overrides; a custom template can execute JavaScript. Data interfaces: [docs/data-contract.md](docs/data-contract.md).

## Low token workflow / 低消耗更新

- **Refresh**: cached local parsing and HTML generation, no AI. Existing summaries are reused; changed discussions are flagged.
- **Improve summaries**: ask your AI to summarize only changed conversations from the bounded snapshot. The AI assistant you choose may consume tokens; it need not run its model on your device.
- **Schedule**: optional. Run the same refresh command using your OS scheduler while your computer is on. No scheduled AI jobs are installed automatically.

Progress is evidence-based: prepared notes do not prove a lesson was taught; code does not prove real-world validation; activity does not measure value. Projects without meaningful progress simply show their discussions.

## Privacy and development

Personal metadata, excerpts, caches and generated HTML live in ignored `.local/`; custom overrides are ignored too. **Generated personal HTML contains your conversation excerpts: keep it private.** Only the fictional examples are suitable for GitHub Pages. No analytics, telemetry, external fonts or model SDKs are included.

```sh
npm test
node src/cli.mjs check
```

The first release provides one adaptable template and a small validated data contract rather than a plugin framework. MIT license. Unofficial community tool; not affiliated with OpenAI.
