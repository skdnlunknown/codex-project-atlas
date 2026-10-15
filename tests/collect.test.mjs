import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecords, localDay, findProject, readable, AUTO_MARKER } from '../src/collect.mjs';

const event = (type, payload = {}, timestamp = '2026-10-15T16:05:00Z') => ({ type: 'event_msg', timestamp, payload: { type, ...payload } });
const message = (text, timestamp = '2026-10-15T16:05:00Z') => ({ type: 'response_item', timestamp, payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
test('Shanghai dates cross UTC midnight correctly', () => {
  assert.equal(localDay('2026-10-15T15:59:59Z'), '2026-10-15');
  assert.equal(localDay('2026-10-15T16:00:00Z'), '2026-10-16');
});
test('human turns retain intent and final, exclude injected instructions and tools', () => {
  const result = parseRecords([event('task_started'), message('# AGENTS.md instructions for x'), message('<external_codex_apps_open_page>{}</external_codex_apps_open_page>'), message('请完成实验'), { type: 'response_item', payload: { type: 'function_call_output', output: '假的进度' } }, event('task_complete', { last_agent_message: '编译通过，实物待测' })]);
  assert.equal(result.daily['2026-10-16'].messages, 1);
  assert.equal(result.latestUser.text, '请完成实验');
  assert.equal(result.latestReply.text, '编译通过，实物待测');
});
test('legacy duplicate user events count once', () => {
  const result = parseRecords([event('task_started'), event('user_message', { message: '同一个请求' }), message('同一个请求'), event('task_complete', { last_agent_message: '回复' })]);
  assert.equal(result.daily['2026-10-16'].messages, 1);
});
test('automatic refresh neither fills heatmap nor replaces human reply', () => {
  const result = parseRecords([event('task_started'), message('学习透视'), event('task_complete', { last_agent_message: '一点透视的要点' }), event('task_started'), message(AUTO_MARKER + ' 运行更新'), event('task_complete', { last_agent_message: 'updated' })]);
  assert.equal(result.daily['2026-10-16'].messages, 1);
  assert.equal(result.latestReply.text, '一点透视的要点');
});
test('unfinished user turn is retained; malformed trailing JSON is tolerated', () => {
  const result = parseRecords([event('task_started'), message('还在进行的讨论'), '{"type":']);
  assert.equal(result.latestUser.text, '还在进行的讨论');
  assert.equal(result.latestReply, null);
  assert.equal(result.malformed, 1);
});
test('ambient browser state is not a user request; completion time uses ISO event timestamp', () => {
  const result = parseRecords([event('task_started'), message('修改装饰'), message('<in-app-browser-context source="ambient-ui-state">背景状态</in-app-browser-context>'), event('task_complete', { last_agent_message: '已调整', completed_at: 1792080300 })]);
  assert.equal(result.daily['2026-10-16'].messages, 1);
  assert.equal(result.latestUser.text, '修改装饰');
  assert.equal(result.latestReply.at, '2026-10-15T16:05:00Z');
});
test('a real request following ambient state is preserved', () => {
  const result = parseRecords([event('task_started'), message('<in-app-browser-context source="ambient-ui-state">背景</in-app-browser-context>\n## My request:\n调整阶梯支脚'), event('task_complete', { last_agent_message: '已恢复固定几何旋转' })]);
  assert.equal(result.latestUser.text, '调整阶梯支脚');
  assert.equal(result.turns[0].reply, '已恢复固定几何旋转');
});
test('injected plugin catalogue is excluded and async answer remains readable', () => {
  const result = parseRecords([event('task_started'), message('<recommended_plugins>列表</recommended_plugins><environment_context>环境</environment_context>'), message('<send_user_message_question_reply>[{"question":"怎么做","answer":"方案B"}]</send_user_message_question_reply>'), event('task_complete')]);
  assert.equal(result.latestUser.text, '方案B');
  assert.equal(result.totalTurns, 1);
});
test('ownership uses explicit membership or longest primary root', () => {
  const projects = [{ id: 'root', path: 'D:/Study' }, { id: 'course', path: 'D:/Study/Course' }];
  assert.equal(findProject({ id: 't', cwd: '\\\\?\\D:\\Study\\Course\\lab' }, projects), 'course');
  assert.equal(findProject({ id: 't', cwd: 'D:/Study/Course' }, projects, { t: { projectId: 'root' } }), 'root');
  assert.equal(findProject({ id: 't', cwd: 'D:/StudyOther' }, projects), null);
});
test('display removes file citations and visualization directives', () => {
  assert.equal(readable('已完成 :codex-file-citation{path="x"} visualize{"path":"x"}'), '已完成');
});
