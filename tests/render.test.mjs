import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildData,render,safeUrl } from '../src/render.mjs';
import {localDay} from '../src/collect.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../defaults/config.json',import.meta.url)));
const source=()=>JSON.parse(fs.readFileSync(new URL('../examples/snapshot.json',import.meta.url)));
test('timezone is configurable across date boundaries',()=>{
  assert.equal(localDay('2026-10-15T16:05:00Z','Asia/Shanghai'),'2026-10-16');
  assert.equal(localDay('2026-10-15T16:05:00Z','America/Los_Angeles'),'2026-10-15');
});
test('custom categories and folding, no progress invented for interests',()=>{
  const data=buildData(source(),{...config,inactiveDays:1},{'demo-art':{group:'自选分类'}},{},new Date('2026-10-15T12:00:00Z'));
  const art=data.projects.find(p=>p.id==='demo-art');
  assert.equal(art.group,'自选分类');assert.deepEqual(art.context.progress,[]);assert.equal(art.stale,true);
});
test('duplicate imports and invalid settings are rejected',()=>{
  const s=source();s.projects.push(s.projects[0]);
  assert.throws(()=>buildData(s,config,{},{}));
  assert.throws(()=>buildData(source(),{...config,historyDays:0},{},{}));
});
test('HTML escaping prevents data escaping its script and custom CSS escaping style',()=>{
  const html=render('<title>Project Atlas · 项目回看</title></head><script>/*__ATLAS_DATA__*/</script>',{title:'<img>',value:'</script><img>'});
  assert.ok(!html.includes('<img>'));assert.ok(html.includes('\\u003c/script>'));
  assert.throws(()=>render('/*__ATLAS_DATA__*/</head>',{title:'x'},'</style><script>'));
  assert.equal(safeUrl('javascript:alert(1)'),'#');assert.equal(safeUrl('//evil.example'),'#');
});
