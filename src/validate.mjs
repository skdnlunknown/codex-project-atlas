const object = x => x && typeof x === 'object' && !Array.isArray(x);
const fail = message => { throw new Error(message); };
const strings = x => Array.isArray(x) && x.every(v => typeof v === 'string');
const iso = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
export function validateConfig(c) {
  if (!object(c) || c.schemaVersion !== 1) fail('Unsupported config schema');
  for (const [key, min, max] of [['historyDays',28,366],['inactiveDays',1,3650]]) if (!Number.isInteger(c[key]) || c[key]<min || c[key]>max) fail('Invalid '+key);
  new Intl.DateTimeFormat('en', { timeZone:c.timezone }).format();
  if (!c.timezone || typeof c.title !== 'string' || typeof c.defaultGroup !== 'string') fail('Missing timezone/title/defaultGroup');
  if (!Array.isArray(c.projects) || !Array.isArray(c.sections) || !strings(c.archivedGroups)) fail('Invalid projects/sections/archivedGroups');
  for (const p of c.projects) if (!p.id || !p.name || typeof p.path !== 'string' || p.kind !== 'local') fail('Invalid configured project');
  for (const s of c.sections) if (typeof s.name !== 'string' || !strings(s.projectIds)) fail('Invalid section');
  return c;
}
export function validateEnrichment(context, summaries) {
  if (!object(context) || !object(summaries)) fail('Context and summaries must be objects');
  for (const p of Object.values(context)) {
    if (!object(p) || (p.progress !== undefined && !Array.isArray(p.progress))) fail('Invalid project context');
    for (const x of p.progress || []) {
      for (const key of ['kind','title','description','overall','recent','date']) if (typeof x[key] !== 'string') fail('Progress requires '+key);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !strings(x.sources)) fail('Progress requires date and sources');
      if (x.stages !== undefined && !Array.isArray(x.stages)) fail('Stages must be an array');
      for (const s of x.stages || []) if (!['done','current','ready','pending'].includes(s.state) || ['title','status','note'].some(k=>typeof s[k]!=='string')) fail('Invalid stage');
      if (x.links !== undefined && (!Array.isArray(x.links) || x.links.some(l=>!object(l)||typeof l.title!=='string'||typeof l.path!=='string'))) fail('Invalid progress links');
    }
  }
  for (const s of Object.values(summaries)) if (!object(s) || typeof s.summary !== 'string' || typeof s.fingerprint !== 'string' || !iso(s.coveredThrough) || (s.topics !== undefined && !strings(s.topics))) fail('Invalid summary or coverage');
}
export function validateSource(source) {
  if (!object(source) || source.schemaVersion !== 1 || !Array.isArray(source.projects)) fail('Unsupported snapshot schema');
  const ids = new Set(), threads = new Set();
  for (const p of source.projects) {
    if (!p.id || !p.name || !Array.isArray(p.threads) || ids.has(p.id)) fail('Invalid or duplicate project');
    ids.add(p.id);
    for (const t of p.threads) {
      const a = t.activity;
      if (!t.id || typeof t.title !== 'string' || threads.has(t.id) || !object(a) || !object(a.daily) || !iso(a.lastActivity) || !Number.isInteger(a.totalTurns) || a.totalTurns<0) fail('Invalid or duplicate conversation');
      threads.add(t.id);
      if (a.turns !== undefined && (!Array.isArray(a.turns) || a.turns.some(x=>!iso(x.at)||typeof x.request!=='string'||typeof x.reply!=='string'))) fail('Invalid turn');
      for (const [day, value] of Object.entries(a.daily)) if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(value.messages) || value.messages<0) fail('Invalid daily activity');
    }
  }
  return source;
}
