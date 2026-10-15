import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReading, fingerprint, brief } from '../src/reading.mjs';

const activity = { firstActivity: '2026-10-12T00:00:00Z', lastActivity: '2026-10-13T00:00:00Z', totalTurns: 2,
  latestUser: { text: '补充条件' }, latestReply: { at: '2026-10-13T00:01:00Z', text: '代码完成，实物待验证。' },
  turns: [{ at: '2026-10-12T00:00:00Z', request: '讲解叠加定理', reply: '说明线性条件。' }, { at: '2026-10-13T00:00:00Z', request: '补充条件', reply: '代码完成，实物待验证。' }] };
const saved = { summary: '已有梗概。', result: '条件已说明。', coveredThrough: activity.lastActivity, fingerprint: fingerprint(activity), topics: ['叠加'] };
test('unchanged sources reuse saved synopsis', () => {
  const r = buildReading({ title: '对话', activity }, saved);
  assert.equal(r.summary, saved.summary);
  assert.equal(r.stale, false);
  assert.deepEqual(r.additions, []);
});
test('new turns preserve original synopsis and expose only later additions', () => {
  const changed = { ...activity, totalTurns: 3, lastActivity: '2026-10-14T00:00:00Z', turns: [...activity.turns, { at: '2026-10-14T00:00:00Z', request: '实车开始测试', reply: '尚未报告结果' }] };
  const r = buildReading({ title: '对话', activity: changed }, saved);
  assert.equal(r.summary, saved.summary);
  assert.equal(r.stale, true);
  assert.equal(r.additions.length, 1);
  assert.equal(r.additions[0].reply, '尚未报告结果');
});
test('a later reply without a new request still marks the synopsis as older', () => {
  const changed = { ...activity, latestReply: { at: '2026-10-13T00:05:00Z', text: '修正后的结果' } };
  const r = buildReading({ title: '对话', activity: changed }, saved);
  assert.equal(r.stale, true);
  assert.equal(r.additions.length, 0);
  assert.equal(r.latest.reply, '修正后的结果');
});
test('fallbacks are extractive and never invent a completion claim', () => {
  const r = buildReading({ title: '对话', activity });
  assert.equal(r.curated, false);
  assert.equal(r.result, '');
  assert.match(r.summary, /讲解叠加定理/);
  assert.match(r.summary, /补充条件/);
  assert.equal(brief('说明\n```js\nsecret()\n```\n|列|值|\n仍待测试'), '说明 仍待测试');
});
