import { clip, readable } from './collect.mjs';

// Extractive fallbacks keep refreshes local. They never infer completion or mastery.
export function brief(text, limit = 170) {
  return clip(readable(text).replace(/```[\s\S]*?```/g, '').replace(/\\\[[\s\S]*?\\\]/g, '').replace(/^\|.*$/gm, '').replace(/^\s*[-*>]\s*/gm, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(), limit);
}
export function fingerprint(activity) {
  return [activity.lastActivity || '', activity.latestReply?.at || '', activity.totalTurns || 0].join('|');
}
export function buildReading(thread, saved) {
  const activity = thread.activity;
  const turns = activity.turns || [];
  const stale = Boolean(saved && saved.fingerprint !== fingerprint(activity));
  const additions = saved ? turns.filter(t => t.at > saved.coveredThrough).slice(-3) : [];
  const first = turns[0], last = turns.at(-1);
  const fallback = [first?.request, last?.request].filter((x,i,a) => x && a.indexOf(x) === i).map(x => brief(x, 115));
  return {
    summary: saved?.summary || fallback.join(' → ') || brief(activity.latestUser?.text || thread.title),
    result: saved?.result || '',
    pending: saved?.pending || '',
    topics: saved?.topics || [],
    curated: Boolean(saved),
    coveredThrough: saved?.coveredThrough || activity.lastActivity,
    stale,
    additions: additions.map(t => ({ at: t.at, request: brief(t.request, 150), reply: brief(t.reply, 170) })),
    recent: turns.slice(-5).map(t => ({ at: t.at, request: brief(t.request, 210), reply: brief(t.reply, 250) })),
    totalTurns: activity.totalTurns || turns.length,
    retainedTurns: turns.length,
    latest: { request: brief(activity.latestUser?.text, 170), reply: brief(activity.latestReply?.text, 220) }
  };
}
