import { localDay } from './collect.mjs';
import { buildReading, fingerprint } from './reading.mjs';
import { validateConfig, validateEnrichment, validateSource } from './validate.mjs';

export function safeUrl(value) {
  const url = String(value || '').trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url) || /^[\/\\]{2}/.test(url)) return '#';
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|file:|codex:)/i.test(url)) return '#';
  return url;
}
export function buildData(source, config, context, summaries, now = new Date()) {
  validateConfig(config); validateSource(source); validateEnrichment(context, summaries);
  const today = localDay(now.getTime(), config.timezone);
  const endMs = Date.parse(today+'T00:00:00Z');
  const startDay = new Date(endMs-(config.historyDays-1)*86400000).toISOString().slice(0,10);
  const allThreads = new Map(source.projects.flatMap(p=>p.threads).map(t=>[t.id,t]));
  const projects = source.projects.map(p=>{
    const threads = [...p.threads].sort((a,b)=>b.activity.lastActivity.localeCompare(a.activity.lastActivity));
    const known = context[p.id] || context[p.name] || {};
    const progress = (known.progress || []).map(x=>({...x,
      links:(x.links||[]).map(l=>({...l,path:safeUrl(l.path)})),
      hasUpdates:(x.sources||[]).some(id=>{
        const t=allThreads.get(id), saved=summaries[id];
        return t && (saved ? fingerprint(t.activity)!==saved.fingerprint : localDay(t.activity.lastActivity,config.timezone)>x.date);
      })
    }));
    const group = known.group || source.sections?.find(s=>s.projectIds.includes(p.id))?.name || p.sidebarGroup || config.defaultGroup;
    const days = {};
    for (const t of threads) for (const day of Object.keys(t.activity.daily)) if(day>=startDay&&day<=today) (days[day] ||= []).push(t.id);
    const lastActivity=threads[0]?.activity.lastActivity || null;
    const lastSeen=[lastActivity,p.metadataLatest?.updatedAt,known.recordDate?known.recordDate+'T00:00:00Z':null].filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0] || null;
    const daysAgo=lastSeen?Math.floor((endMs-Date.parse(localDay(lastSeen,config.timezone)+'T00:00:00Z'))/86400000):null;
    return {...p,group,stale:daysAgo===null||daysAgo>config.inactiveDays||config.archivedGroups.includes(group),days,lastActivity,lastSeen,daysAgo,
      directoryUrl:p.directoryUrl?safeUrl(p.directoryUrl):null,
      metadataLatest:p.metadataLatest?{...p.metadataLatest,url:safeUrl(p.metadataLatest.url)}:null,
      context:{...known,progress},threads:threads.map(t=>({...t,url:safeUrl(t.url||'codex://threads/'+t.id),reading:buildReading(t,summaries[t.id])}))};
  });
  return {schemaVersion:1,title:config.title,timezone:config.timezone,generatedAt:now.toISOString(),today,startDay,historyDays:config.historyDays,inactiveDays:config.inactiveDays,
    groupOrder:config.sections.map(s=>s.name),warnings:source.warnings||[],projects,refreshRequest:'请在 Project Atlas 仓库运行 node src/cli.mjs refresh，只检查简短结果；无需重读历史或重新总结。'};
}
export function render(template,data,css='') {
  if (!template.includes('/*__ATLAS_DATA__*/')) throw new Error('Template requires /*__ATLAS_DATA__*/');
  if (/<\/style/i.test(css)) throw new Error('theme.css cannot contain a closing style tag');
  const json=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  const title=String(data.title).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return template.replace('/*__ATLAS_DATA__*/','const DATA = '+json+';').replace('<title>Project Atlas · 项目回看</title>','<title>'+title+'</title>').replace('</head>',()=>'<style>'+css+'</style></head>');
}
