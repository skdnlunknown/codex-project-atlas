# Data contract (v1)

All user state lives in ignored `.local/`. Run `node src/cli.mjs init` to create empty files. Refresh validates before replacing the page. No remote service or model API is used.

## config.json

Defaults are in `defaults/config.json`. Set `timezone` to an IANA timezone, `inactiveDays` (1–3650), `historyDays` (28–366), `title`, and `defaultGroup`. `sections` is an array of `{name, projectIds:[stableId]}`. Set `preferCodexGroups:false` to override sidebar grouping. `archivedGroups` lists groups to fold.

`projects` is an optional array of `{id,name,path,kind:"local"}`. Explicit entries override detected projects with the same ID; different entries add projects. Use this when project discovery is unavailable. `codexHome` optionally overrides the default `CODEX_HOME` or `~/.codex` directory. Keep absolute paths private.

## context.json

Object keyed by stable project ID (project name also accepted as a migration fallback):

```json
{
  "demo-course": {
    "purpose": "课程复习",
    "type": "course",
    "group": "课程",
    "progress": [{
      "kind": "课程", "title": "第 3 章 · 3.2 节",
      "description": "本节内容与范围",
      "overall": "讲解到这里，掌握度尚未验证",
      "recent": "补充了一个例题", "date": "2026-10-15",
      "sources": ["demo-thread"],
      "stages": [{"title":"第 3 章","state":"current","status":"已讲解","note":"练习待做"}]
    }]
  }
}
```

`progress` is optional and may contain multiple tracks. Stage states: `done`, `current`, `ready`, `pending`; `status` supplies the meaningful user-facing interpretation. Optional links are `{title,path}`. Use only http(s), file, codex links or relative paths. Other project types can use descriptive progress without stages or provide a custom template. Unknown fields are retained for custom renderers.

## summaries.json

Object keyed by thread ID. A summary record has `summary`, optional `result`, `pending`, `topics`, and required `fingerprint` and ISO timestamp `coveredThrough`. Fingerprint format: `lastActivity|latestReply.at|totalTurns` (empty timestamps allowed). Refresh marks changed records stale and exposes recent excerpts; it never silently claims an old summary covers new turns.

## Import and snapshot.json

`node src/cli.mjs refresh --import /path/to/snapshot.json` accepts `{schemaVersion:1, projects:[...]}`. Each project requires `id`, `name`, `kind`, optional `path`/`sidebarGroup`, and `threads`. A thread requires `id`, `title`, `activity`; `url` is optional. Activity requires `daily:{"YYYY-MM-DD":{messages:1,lastAt:"ISO"}}`, `lastActivity`, `totalTurns`, and optional `firstActivity`, `latestUser:{at,text}`, `latestReply:{at,text}`, `turns:[{at,request,reply,replyAt}]`. Imported daily buckets must already use the configured timezone. See `examples/snapshot.json` for a complete synthetic example.

The live adapter writes this bounded snapshot for incremental AI work. It retains at most 60 turn excerpts per conversation, not complete transcripts. Missing local histories are reported; blank heatmap cells mean no observed activity in readable records, not proof of inactivity. The Codex adapter depends on internal storage and is not an official API. Currently tested with local Windows Codex storage; macOS/Linux compatibility is unverified.
