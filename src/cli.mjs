import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collect } from './collect.mjs';
import { buildData, render } from './render.mjs';
import { validateConfig, validateEnrichment, validateSource } from './validate.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local=path.join(root,'.local');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const optional=(file,fallback)=>fs.existsSync(file)?read(file):fallback;
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.next',value,'utf8');fs.renameSync(file+'.next',file);};
const command=process.argv[2]||'help';
let lockFd;
const lock=path.join(local,'refresh.lock');
try {
  if(command==='init') {
    fs.mkdirSync(local,{recursive:true});
    for(const [file,value] of [['config.json',read(path.join(root,'defaults/config.json'))],['context.json',{}],['summaries.json',{}]]) if(!fs.existsSync(path.join(local,file))) write(path.join(local,file),JSON.stringify(value,null,2)+'\n');
    console.log(JSON.stringify({status:'initialized',directory:local}));
  } else if(command==='demo') {
    const config=read(path.join(root,'defaults/config.json'));
    config.sections=[{name:'课程',projectIds:['demo-course']},{name:'开发',projectIds:['demo-site']},{name:'兴趣',projectIds:['demo-art']}];
    const data=buildData(read(path.join(root,'examples/snapshot.json')),config,read(path.join(root,'examples/context.json')),read(path.join(root,'examples/summaries.json')),new Date('2026-10-15T12:00:00Z'));
    data.warnings=['演示项目及谈话全部虚构，不包含任何用户历史。'];
    data.refreshRequest='这是虚构演示。请下载 Project Atlas，运行 node src/cli.mjs init 和 node src/cli.mjs refresh 后打开自己的 .local/index.html。';
    write(path.join(root,'examples/index.html'),render(fs.readFileSync(path.join(root,'defaults/template.html'),'utf8'),data));
    console.log(JSON.stringify({status:'demo',file:path.join(root,'examples/index.html')}));
  } else if(command==='refresh'||command==='check') {
    if(!fs.existsSync(path.join(local,'config.json'))) throw new Error('Run node src/cli.mjs init first');
    const config={...read(path.join(root,'defaults/config.json')),...read(path.join(local,'config.json'))};
    const context=optional(path.join(local,'context.json'),{}),summaries=optional(path.join(local,'summaries.json'),{});
    validateConfig(config);validateEnrichment(context,summaries);
    if(command==='check') {
      if(fs.existsSync(path.join(local,'snapshot.json'))) validateSource(read(path.join(local,'snapshot.json')));
      console.log('{"status":"valid"}');
    } else {
      try {lockFd=fs.openSync(lock,'wx');fs.writeSync(lockFd,String(process.pid));}
      catch(e){if(e.code==='EEXIST') throw new Error('Refresh is already running; if a process crashed, remove .local/refresh.lock after checking it has stopped');throw e;}
      const flag=process.argv.indexOf('--import');
      if(flag!==-1&&!process.argv[flag+1]) throw new Error('--import requires a snapshot path');
      const imported=flag!==-1;
      const source=imported?read(path.resolve(process.argv[flag+1])):await collect(config,{codexHome:config.codexHome||process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),cacheFile:path.join(local,'cache.json'),previous:optional(path.join(local,'snapshot.json'),{})});
      source.schemaVersion=imported?source.schemaVersion:1;
      if(!imported) for(const p of source.projects) if(p.path) p.directoryUrl=pathToFileURL(p.path+path.sep).href;
      const data=buildData(source,config,context,summaries);
      const customTemplate=path.join(root,'custom/template.html'),theme=path.join(root,'custom/theme.css');
      const html=render(fs.readFileSync(fs.existsSync(customTemplate)?customTemplate:path.join(root,'defaults/template.html'),'utf8'),data,fs.existsSync(theme)?fs.readFileSync(theme,'utf8'):'');
      // Complete reads, validation and rendering before replacing the last good page.
      if(source.cache) write(path.join(local,'cache.json'),JSON.stringify(source.cache));
      const {cache,...snapshot}=source;
      write(path.join(local,'snapshot.json'),JSON.stringify(snapshot,null,2));
      if(fs.existsSync(path.join(local,'index.html'))) fs.copyFileSync(path.join(local,'index.html'),path.join(local,'previous.html'));
      write(path.join(local,'index.html'),html);
      console.log(JSON.stringify({status:'updated',projects:data.projects.length,...source.stats,file:path.join(local,'index.html')}));
    }
  } else {
    console.log('Project Atlas: node src/cli.mjs init | demo | refresh [--import FILE] | check');
    if(command!=='help') process.exitCode=1;
  }
} catch(error) {
  console.error(JSON.stringify({status:'failed',message:error.message,previousPagePreserved:true}));process.exitCode=1;
} finally {
  if(lockFd!==undefined){fs.closeSync(lockFd);fs.unlinkSync(lock);}
}
