import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('fresh install, private overrides, import and failure preserve last good HTML',()=>{
  const sandbox=fs.mkdtempSync(path.join(root,'tmp-test-'));
  try {
    for(const dir of ['src','defaults']) fs.cpSync(path.join(root,dir),path.join(sandbox,dir),{recursive:true});
    const run=(...args)=>spawnSync(process.execPath,[path.join(sandbox,'src/cli.mjs'),...args],{encoding:'utf8'});
    assert.equal(run('init').status,0);
    const configFile=path.join(sandbox,'.local/config.json');
    const config=JSON.parse(fs.readFileSync(configFile));config.title='个人标题';fs.writeFileSync(configFile,JSON.stringify(config));
    assert.equal(run('init').status,0);assert.equal(JSON.parse(fs.readFileSync(configFile)).title,'个人标题');
    const imported=run('refresh','--import',path.join(root,'examples/snapshot.json'));assert.equal(imported.status,0,imported.stderr);
    const htmlFile=path.join(sandbox,'.local/index.html'), html=fs.readFileSync(htmlFile,'utf8');
    assert.ok(html.includes('<title>个人标题</title>'));
    const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
    fs.writeFileSync(path.join(sandbox,'bad.json'),'{"schemaVersion":99}');
    assert.equal(run('refresh','--import',path.join(sandbox,'bad.json')).status,1);
    assert.equal(fs.readFileSync(htmlFile,'utf8'),html);
    assert.equal(run('refresh','--import').status,1);
    assert.equal(fs.readFileSync(htmlFile,'utf8'),html);
  } finally {
    // The only recursive deletion is the verified test directory below this checkout.
    assert.equal(path.dirname(sandbox),root);assert.ok(path.basename(sandbox).startsWith('tmp-test-'));
    fs.rmSync(sandbox,{recursive:true,force:true});
  }
});
