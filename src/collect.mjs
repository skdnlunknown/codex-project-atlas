import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';

export const PARSER_VERSION = 6;
export const AUTO_MARKER = 'PROJECT_ATLAS_AUTO_REFRESH';
export const cleanPath = value => String(value || '').replace(/^\\\\\?\\/, '');
export const normalized = value => cleanPath(value).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
export const localDay = (value, timezone='Asia/Shanghai') => {
 const ms=typeof value==='number'?value:Date.parse(value); if(!Number.isFinite(ms)) return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
 const f=t=>parts.find(p=>p.type===t).value; return f('year')+'-'+f('month')+'-'+f('day');
};
export const clip = (text, size = 900) => {
  const value = String(text || '').trim();
  return value.length > size ? value.slice(0, size) + '…' : value;
};
export function readable(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(<?[^)]*?>?\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/:{1,2}[a-z-]+\{[^}]*\}/g, '')
    .replace(/[\s\S]*?/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export function userText(text) {
  let value = String(text || '').trim();
  if (/^(# AGENTS\.md instructions|<recommended_plugins>|<environment_context>|<external_codex_apps_|<permissions instructions>|<INSTRUCTIONS>|<user_instructions>|<skills_instructions>|<turn_aborted>)/.test(value)) return '';
  value = value.replace(/<in-app-browser-context\b[\s\S]*?<\/in-app-browser-context>/g, '').replace(/^\s*## My request:\s*/i, '');
  value = value.replace(/<send_user_message_question_reply>([\s\S]*?)<\/send_user_message_question_reply>/g, (_, json) => {
    try { return JSON.parse(json).map(x => x.answer || '').join('；'); } catch { return ''; }
  });
  value = value.replace(/^Files mentioned by the user:\s*\n/gm, '').replace(/^([^\n]+?): [A-Za-z]:[/\\][^\n]*$/gm, '［附件：$1］');
  return value.trim();
}

// Only actual user messages and final replies are retained. Tools, reasoning,
// system/developer instructions and generated maintenance turns never become activity.
export function createParser({timezone='Asia/Shanghai'}={}) {
  const daily = {};
  const turns = [];
  let turn = { users: [], auto: false, final: '', finalAt: null };
  let latestUser = null, latestReply = null, firstActivity = null, lastActivity = null;
  let malformed = 0;
  const seen = new Set();
  function flush() {
    if (!turn.auto && turn.users.length) {
      for (const user of turn.users) {
        const key = user.at + '\n' + user.text;
        if (seen.has(key)) continue;
        seen.add(key);
        const day = localDay(user.at,timezone);
        if (!day) continue;
        daily[day] ||= { messages: 0, lastAt: user.at };
        daily[day].messages++;
        if (user.at > daily[day].lastAt) daily[day].lastAt = user.at;
        if (!firstActivity || user.at < firstActivity) firstActivity = user.at;
        if (!lastActivity || user.at > lastActivity) lastActivity = user.at;
        if (!latestUser || user.at >= latestUser.at) latestUser = user;
      }
      if (turn.final && (!latestReply || turn.finalAt >= latestReply.at)) {
        latestReply = { at: turn.finalAt, text: clip(readable(turn.final), 2200) };
      }
      turns.push({ at: turn.users[0].at, request: clip(turn.users.map(u => u.text).join('；'), 400), reply: clip(readable(turn.final), 900), replyAt: turn.finalAt });
    }
    turn = { users: [], auto: false, final: '', finalAt: null };
  }
  function user(text, at) {
    const value = userText(text);
    if (value.includes(AUTO_MARKER)) { turn.auto = true; return; }
    if (!value) return;
    // Legacy rollouts can repeat the same user message in event_msg and response_item.
    if (turn.users.some(u => u.text === clip(readable(value), 350))) return;
    turn.users.push({ at, text: clip(readable(value), 350) });
  }
  return {
    push(line) {
      let x;
      try { x = typeof line === 'string' ? JSON.parse(line) : line; }
      catch { if (String(line).trim()) malformed++; return; }
      const p = x.payload || {}, at = x.timestamp;
      if (x.type === 'event_msg' && p.type === 'task_started') flush();
      if (x.type === 'event_msg' && p.type === 'user_message') user(p.message, at);
      if (x.type === 'event_msg' && p.type === 'item_completed' && p.item?.type === 'UserMessage') user((p.item.content || []).map(c => c.text || '').join('\n'), at);
      if (x.type === 'response_item' && p.type === 'message' && p.role === 'user') {
        const text = (p.content || []).filter(c => c.type === 'input_text' || c.type === 'text').map(c => c.text || '').join('\n');
        user(text || ((p.content || []).some(c => /image|audio/.test(c.type)) ? '［图片或音频附件］' : ''), at);
      }
      if (x.type === 'response_item' && p.type === 'message' && p.role === 'assistant' && (p.channel === 'final' || p.phase === 'final')) {
        turn.final = (p.content || []).map(c => c.text || '').join('\n'); turn.finalAt = at;
      }
      if (x.type === 'event_msg' && p.type === 'task_complete') {
        if (p.last_agent_message) { turn.final = p.last_agent_message; turn.finalAt = at; }
        flush();
      }
    },
    finish() { flush(); return { daily, latestUser, latestReply, firstActivity, lastActivity, malformed, totalTurns: turns.length, turns: turns.length > 60 ? [...turns.slice(0, 6), ...turns.slice(-54)] : turns }; }
  };
}
export function parseRecords(records, options) {
  const parser = createParser(options);
  for (const record of records) parser.push(record);
  return parser.finish();
}
export async function parseFile(file, options) {
  const parser = createParser(options);
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) parser.push(line);
  return parser.finish();
}
export function findProject(row, projects, assignments = {}, aliases = {}) {
  const explicit = assignments[row.id]?.projectId || aliases[row.project_id] || row.project_id;
  if (projects.some(p => p.id === explicit)) return explicit;
  const cwd = normalized(row.cwd);
  // Only a project's primary root counts; extra allowed directories are not ownership.
  return projects.filter(p => p.path && (cwd === normalized(p.path) || cwd.startsWith(normalized(p.path) + '/')))
    .sort((a, b) => b.path.length - a.path.length)[0]?.id || null;
}

export async function collect(config, { codexHome, cacheFile, previous = {} }) {
  const warnings = [];
  let global;
  try { global = JSON.parse(fs.readFileSync(path.join(codexHome, '.codex-global-state.json'), 'utf8')); }
  catch {
    if (!config.projects.length) throw new Error('无法读取 Codex 项目登记信息；请配置本地项目或使用 JSON 导入。保留上次网页。');
    global = {};
    warnings.push('Codex 项目登记不可读，使用配置中的项目入口。');
  }
  const locals = Object.values(global['local-projects'] || {});
  const projects=locals.map(p=>({id:p.id,name:p.name,path:cleanPath(p.rootPaths?.[0]),kind:'local'}));
 for(const p of config.projects.filter(p=>p.kind==='local')){const i=projects.findIndex(x=>x.id===p.id);if(i<0)projects.push(p);else projects[i]={...projects[i],...p};}
  projects.push(...config.projects.filter(p => p.kind !== 'local'));
  let sections = config.sections;
  const sectionSets = Object.values(global['electron-persisted-atom-state']?.['sidebar-custom-sections-v3'] || {});
  const best = sectionSets.map(s => ({ s, score: (s.sections || []).reduce((n, section) => n + (section.itemKeys || []).filter(k => projects.some(p => k.endsWith(':project:' + p.id))).length, 0) })).sort((a, b) => b.score - a.score)[0];
  if (config.preferCodexGroups && best?.score) sections = best.s.sections.map(s => ({ name: s.name, projectIds: (s.itemKeys || []).filter(k => k.includes(':project:')).map(k => k.split(':project:')[1]) }));
  const migration = global['app-server-project-id-by-legacy-project-id-by-host'] || {};
  const aliases = {};
  for (const map of Object.values(migration)) for (const [legacy, internal] of Object.entries(map)) aliases[internal] = legacy;
  let db, rows;
  try {
    db = new DatabaseSync(path.join(codexHome, 'state_5.sqlite'), { readOnly: true });
    const columns = new Set(db.prepare('pragma table_info(threads)').all().map(x => x.name));
    for (const required of ['id', 'cwd', 'rollout_path', 'title', 'source']) if (!columns.has(required)) throw new Error('schema');
    const select = ['id', 'cwd', 'rollout_path', 'title', 'name', 'source', 'thread_source', 'agent_path', 'project_id', 'archived', 'updated_at'].filter(k => columns.has(k)).join(',');
    rows = db.prepare(`select ${select} from threads`).all();
  } catch { throw new Error('Codex 本地记录格式不可用；保留上次网页，请在对话中检查适配。'); }
  finally { db?.close(); }
  let cache = { version: PARSER_VERSION + ':' + config.timezone, threads: {} };
  try { const old = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); if (old.version === PARSER_VERSION + ':' + config.timezone) cache = old; } catch {}
  const previousById = new Map((previous.projects || []).flatMap(p => p.threads || []).map(t => [t.id, t]));
  const names = new Map(config.fallbackThreads.map(t => [t.id, t]));
  const grouped = new Map(projects.map(p => [p.id, []]));
  const metadata = new Map();
  let parsed = 0, reused = 0, missing = 0, excluded = 0;
  for (const row of rows) {
    if ((row.thread_source && row.thread_source !== 'user') || row.agent_path || /subagent|guardian|automation/i.test(row.source || '') || /^(Guardian review|Project Atlas 自动更新)/i.test(row.name || row.title || '')) { excluded++; continue; }
    const projectId = findProject(row, projects, global['thread-project-assignments'], aliases);
    if (!projectId) continue;
    const title = row.name || names.get(row.id)?.title || clip(row.title, 50) || '未命名聊天';
    if (row.updated_at && (!metadata.has(projectId) || row.updated_at > metadata.get(projectId).updatedSeconds)) {
      metadata.set(projectId, { id: row.id, title, updatedAt: new Date(row.updated_at * 1000).toISOString(), updatedSeconds: row.updated_at, url: 'codex://threads/' + row.id });
    }
    const file = cleanPath(row.rollout_path);
    let result;
    try {
      const stat = fs.statSync(file), cached = cache.threads[row.id];
      if (cached && cached.size === stat.size && cached.mtime === stat.mtimeMs) { result = cached.result; reused++; }
      else { result = await parseFile(file,{timezone:config.timezone}); parsed++; cache.threads[row.id] = { size: stat.size, mtime: stat.mtimeMs, result }; }
    } catch {
      missing++;
      result = cache.threads[row.id]?.result || previousById.get(row.id)?.activity;
      if (!result) continue;
    }
    if (!result.lastActivity) continue;
    grouped.get(projectId).push({ id: row.id, title, archived: Boolean(row.archived), url: 'codex://threads/' + row.id, activity: result });
  }
  if (missing) warnings.push(`${missing} 份本地对话记录暂不可读，已有记录保留；未读取部分不当作无活动。`);
  if (projects.some(p => p.kind !== 'local')) warnings.push('云端 ChatGPT 项目仅保留入口登记，尚未自动读取其聊天；热力图覆盖本机 Codex 用户对话。');
  return { projects: projects.map(p => ({ ...p, metadataLatest: metadata.get(p.id) || null, sidebarGroup: sections.find(s => s.projectIds.includes(p.id))?.name || null, threads: grouped.get(p.id).sort((a, b) => b.activity.lastActivity.localeCompare(a.activity.lastActivity)) })), sections, warnings, cache, stats: { parsed, reused, missing, excluded } };
}
