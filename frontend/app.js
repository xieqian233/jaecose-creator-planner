(async()=>{
async function cloudRequest(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});let data;try{data=await response.json()}catch{throw new Error('服务器未返回有效数据，请刷新重试。')}if(!response.ok)throw new Error(data.error||'请求未完成，请重试。');return data;}
const initial=await cloudRequest('/api/state');
if(!initial.configured){document.getElementById('connectionMessage').textContent='新飞书排期表已创建。飞书应用尚未完成授权和服务器密钥连接，完成后即可共享排期。';const link=document.getElementById('setupTableLink');if(initial.planUrl){link.href=initial.planUrl;link.hidden=false;}return;}
try{await cloudRequest('/api/sync',{method:'POST',body:'{}'})}catch(error){document.getElementById('connectionMessage').textContent=error.message;return;}
const CLOUD_BOOT=await cloudRequest('/api/state'),SEED=CLOUD_BOOT.dataset;
document.getElementById('cloudConnection').hidden=true;document.querySelector('.app').hidden=false;
'use strict';
const $=id=>document.getElementById(id);

const GRADES=['A','A-','B','C'];
const DIRS=['时间压缩','最小底妆','移动底妆','局部修补','单品测评','同品类对比','跨品类对比','待定'];
const GCOL={'A':'#557a69','A-':'#8aaf88','B':'#76a9d4','C':'#efb58f'};
const DCOL={'时间压缩':'#557a69','最小底妆':'#8aaf88','移动底妆':'#76a9d4','局部修补':'#efb58f','单品测评':'#b6a0df','同品类对比':'#c4ac6a','跨品类对比':'#b4c4b7','待定':'#d4d9d3'};
const PRODUCTION=['待确认','待脚本','待拍摄','已拍待初稿','待修改','待发布','已发布'];
const OUTCOMES=['待测试','已发布待观察','有初步信号','需要复测','本次不适配'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const iso=d=>d.toISOString().slice(0,10);
const parseDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?new Date(`${s}T00:00:00Z`):null;
const addDays=(s,n)=>{const d=parseDate(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
const monday=s=>{const d=parseDate(s);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return iso(d)};
const short=s=>s?`${String(Number(s.slice(5,7))).padStart(2,'0')}/${s.slice(8,10)}`:'待确认';
const pct=(n,d)=>d?`${Math.round(n/d*100)}%`:'0%';
const gradeClass=g=>g==='A-'?'Aminus':g;
function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}}
let dataset=structuredClone(SEED),patches=structuredClone(CLOUD_BOOT.patches||{}),storageOk=true,editingId=null,toastTimer,sourceMigrated=false;
const state={grade:'',direction:'',datePreset:'all',from:'',to:'',search:'',selectedOnly:false,tab:'all',dateMode:'availability',grain:'day',buckets:[]};
function mergePatches(input,oldRecords,newRecords){
 const oldById=new Map((oldRecords||[]).map(r=>[r.id,r])),newById=new Map(newRecords.map(r=>[r.id,r]));
 const newByName=new Map(newRecords.map(r=>[r.name.trim(),r]));const merged={};
 for(const [id,p]of Object.entries(input||{})){
  const before=oldById.get(id),after=newById.get(id)||(before&&newByName.get(before.name.trim()));
  if(!after||!p||typeof p!=='object')continue;const next={...p};
  if(before&&(before.sourcePrimary!==after.sourcePrimary||JSON.stringify([...(before.directions||[])].sort())!==JSON.stringify([...(after.directions||[])].sort())||(after.primaryReviewed&&!before.primaryReviewed)))delete next.primary;
  merged[after.id]=next;
 }
 return cleanPatches(merged,newRecords);
}
function restoreBackup(parsed){
 const incoming=parsed.dataset,keepCurrent=(dataset.snapshotDate||'')>(incoming.snapshotDate||'');
 const target=keepCurrent?dataset:incoming;
 patches=mergePatches(parsed.patches,incoming.records,target.records);
 dataset={...target,initialCount:incoming.initialCount||target.initialCount};
 return keepCurrent;
}
function effective(r){const p=patches[r.id]||{};return {...r,primary:own(p,'primary')?p.primary:r.sourcePrimary,planned:p.planned||'',production:p.production||'待确认',outcome:p.outcome||'待测试',hypothesis:p.hypothesis||'',conclusion:p.conclusion||'',note:p.note||'',selected:!!p.selected}}
function connected(){return dataset.records.filter(r=>r.contact==='已建联').map(effective)}
function fieldDate(r){return state.dateMode==='availability'?r.availability:r.planned}
function dateRange(){if(state.datePreset.startsWith('week:')){const from=state.datePreset.slice(5);return {from,to:addDays(from,6)}}return {from:state.from,to:state.to}}
function filtered(){const range=dateRange();return connected().filter(r=>{
 if(state.grade&&r.grade!==state.grade)return false;
 if(state.direction&&r.primary!==state.direction)return false;
 if(state.selectedOnly&&!r.selected)return false;
 const query=state.search.trim().toLowerCase();if(query&&!`${r.name} ${r.skin} ${r.tone} ${r.memo} ${r.primary} ${r.note}`.toLowerCase().includes(query))return false;
 const d=fieldDate(r);if(state.datePreset==='undated')return !d;
 if(state.datePreset==='custom'||state.datePreset.startsWith('week:')){if(!d)return false;if(range.from&&d<range.from)return false;if(range.to&&d>range.to)return false}
 return true;
})}
function tableRows(){return filtered().filter(r=>state.tab==='unplanned'?!r.planned:state.tab==='pending'?r.primary==='待定':state.tab==='results'?!!r.conclusion||!['待测试','已发布待观察'].includes(r.outcome):true).sort((a,b)=>GRADES.indexOf(a.grade)-GRADES.indexOf(b.grade)||(a.availability||'9999').localeCompare(b.availability||'9999')||a.name.localeCompare(b.name,'zh-CN'))}
function save(message){$('saveState').textContent='已保存到飞书';if(message)toast(message)}
let cloudSaving=0,syncBusy=false;
const editableKeys=['primary','planned','production','outcome','hypothesis','conclusion','note','selected'];
async function persistEntries(entries,message){
 if(!entries.length){if(message)toast('没有需要保存的修改。');return true;}
 cloudSaving++;$('saveState').textContent='正在保存…';
 try{const result=await cloudRequest('/api/creators',{method:'PATCH',body:JSON.stringify({entries})});Object.assign(patches,result.patches);save(message||'已保存至新飞书协作表。');render();return true;}
 catch(error){$('saveState').textContent='保存未完成';toast(error.message);render();return false;}
 finally{cloudSaving--;}
}
async function updatePatch(id,next,message){const row=connected().find(r=>r.id===id);if(!row)return false;const changes={};for(const key of editableKeys)if(Object.hasOwn(next,key)&&next[key]!==row[key])changes[key]=next[key];return persistEntries(Object.keys(changes).length?[{id,changes,expectedUpdatedAt:patches[id]?.remoteUpdatedAt||0}]:[],message);}

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true},3600)}
function installOptions(){
 $('directionFilter').innerHTML='<option value="">全部方向</option>'+DIRS.map(d=>`<option>${esc(d)}</option>`).join('');
 const weeks=[...new Set(connected().filter(r=>r.availability).map(r=>monday(r.availability)))].sort();
 $('datePreset').innerHTML='<option value="all">全部日期</option>'+weeks.map(w=>`<option value="week:${w}">${short(w)}—${short(addDays(w,6))}</option>`).join('')+'<option value="undated">日期待补</option><option value="custom">自定义范围</option>';
 $('editPrimary').innerHTML=DIRS.map(x=>`<option>${esc(x)}</option>`).join('');
 $('editProduction').innerHTML=PRODUCTION.map(x=>`<option>${esc(x)}</option>`).join('');
 $('editOutcome').innerHTML=OUTCOMES.map(x=>`<option>${esc(x)}</option>`).join('');
 $('gradeLegend').innerHTML=GRADES.map(g=>`<span class="legend-item"><i class="swatch" style="background:${GCOL[g]}"></i>${esc(g)}</span>`).join('');
 $('directionLegend').innerHTML=DIRS.map(d=>`<button data-direction="${esc(d)}"><i class="swatch" style="background:${DCOL[d]}"></i>${esc(d)}</button>`).join('');
}
function render(){
 const rows=filtered(),all=connected();
 const sourceNote=$('sourceUpdateNote');
 if(sourceNote){const extra=all.filter(r=>r.sourcePrimaryNote).map(r=>`${r.name}：${r.sourcePrimaryNote}`).join('；');sourceNote.textContent=`飞书数据 ${dataset.snapshotDate} · 已建联${all.length}位 · 单品测评${all.filter(r=>r.primary==='单品测评').length}位${extra?`。${extra}`:''}`;}
 $('statCount').textContent=rows.length;$('statDated').textContent=rows.filter(r=>r.availability).length;$('statUndated').textContent=rows.filter(r=>!r.availability).length;$('statPending').textContent=rows.filter(r=>r.primary==='待定').length;
 $('selectedCount').textContent=all.filter(r=>r.selected).length;
 $('filterSummary').textContent=`当前筛选 ${rows.length} 位／已建联 ${all.length} 位${state.dateMode==='planned'?' · 日期筛选按拟发布日期':''}`;
 $('gradeFilter').value=state.grade;$('directionFilter').value=state.direction;$('datePreset').value=state.datePreset;$('search').value=state.search;$('selectedOnly').checked=state.selectedOnly;
 $('customDates').hidden=state.datePreset!=='custom';$('dateFrom').value=state.from;$('dateTo').value=state.to;
 [['modeAvailability',state.dateMode==='availability'],['modePlanned',state.dateMode==='planned'],['byDay',state.grain==='day'],['byWeek',state.grain==='week']].forEach(([id,active])=>{$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.tab));
 $('chartCaption').textContent=state.dateMode==='availability'?'原表可发布档期，不代表已确认合作或发布':'新协作表拟排日期，不代表达人已确认';
 drawHistogram(rows);drawDirections(rows);drawInsights(rows);drawTable();drawFunnel();
 $('sourceStatus').textContent=`飞书快照 ${dataset.snapshotDate} · 当前表 ${dataset.records.length} 条 · 排期写入独立协作表，原筛选表只读`;
 if(!storageOk)$('saveState').textContent='请导出备份';
}
function makeBuckets(rows){
 const dated=rows.filter(r=>fieldDate(r));const map=new Map();
 for(const r of dated){const day=fieldDate(r);const key=state.grain==='week'?monday(day):day;if(!map.has(key))map.set(key,{key,end:state.grain==='week'?addDays(key,6):key,rows:[],counts:Object.fromEntries(GRADES.map(g=>[g,0]))});const b=map.get(key);b.rows.push(r);if(own(b.counts,r.grade))b.counts[r.grade]++}
 let start,end;const range=dateRange();
 if((state.datePreset==='custom'||state.datePreset.startsWith('week:'))&&range.from&&range.to){start=range.from;end=range.to}else{const dates=dated.map(fieldDate).sort();start=dates[0];end=dates.at(-1)}
 if(!start||!end)return [];
 if(state.grain==='week'){start=monday(start);end=monday(end)}
 const result=[];for(let d=start,n=0;d<=end&&n<400;d=addDays(d,state.grain==='week'?7:1),n++){result.push(map.get(d)||{key:d,end:state.grain==='week'?addDays(d,6):d,rows:[],counts:Object.fromEntries(GRADES.map(g=>[g,0]))})}
 return result;
}
function drawHistogram(rows){
 const host=$('histogram'),W=Math.max(300,host.clientWidth),H=host.clientHeight||285;
 const buckets=makeBuckets(rows);state.buckets=buckets;
 const known=rows.filter(r=>fieldDate(r)).length;
 $('chartFoot').textContent=`图中 ${known} 位，日期待补 ${rows.length-known} 位。点击有人的柱子筛选该时段；人数按达人去重，尚未强制内容比例。`;
 if(!buckets.length){host.innerHTML=`<div class="empty-state" style="padding:65px 12px"><strong>${state.dateMode==='planned'?'尚未安排拟发布日期':'当前没有可绘制的档期'}</strong><p>${state.dateMode==='planned'?'在下方名单填写日期后，查看发布是否集中。':'未填日期的达人仍保留在名单中，可筛选“日期待补”。'}</p></div>`;return}
 const L=32,R=9,T=23,B=44,iw=W-L-R,ih=H-T-B,max=Math.max(1,...buckets.map(b=>b.rows.length)),step=max<=5?1:max<=10?2:Math.ceil(max/5),top=Math.ceil(max/step)*step;
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${state.dateMode==='availability'?'可发布档期':'拟发布日期'}人数柱状分布"><text x="0" y="12" font-size="11" fill="#68736d">人数</text>`;
 for(let y=0;y<=top;y+=step){const py=T+ih-y/top*ih;svg+=`<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="#e1e6e0" stroke-dasharray="3 3"/><text x="${L-9}" y="${py+4}" text-anchor="end" font-size="10" fill="#778177">${y}</text>`}
 const slot=iw/buckets.length,bw=Math.min(state.grain==='week'?76:32,slot*.73),labelEvery=Math.max(1,Math.ceil(buckets.length/(W<480?6:12)));
 buckets.forEach((b,i)=>{
  const x=L+slot*i+(slot-bw)/2;let bottom=T+ih;
  GRADES.forEach(g=>{const value=b.counts[g],height=value/top*ih;if(value){bottom-=height;svg+=`<rect x="${x}" y="${bottom}" width="${bw}" height="${height+.2}" fill="${GCOL[g]}"/>`}});
  if(b.rows.length)svg+=`<text x="${x+bw/2}" y="${bottom-6}" text-anchor="middle" font-size="10" fill="#607167">${b.rows.length}</text><rect class="bar-hit" data-bucket="${i}" x="${L+slot*i}" y="${T}" width="${slot}" height="${ih+2}" role="button" tabindex="0" aria-label="${b.key}${state.grain==='week'?'起的一周':''}，${b.rows.length}位达人，点击筛选"><title>${esc(b.key)}：${b.rows.length}位</title></rect>`;
  if(i%labelEvery===0||i===buckets.length-1)svg+=`<text x="${x+bw/2}" y="${T+ih+20}" text-anchor="middle" font-size="${W<480?9:10}" fill="#68736d">${short(b.key)}</text>`;
 });
 svg+=`<line x1="${L}" x2="${W-R}" y1="${T+ih}" y2="${T+ih}" stroke="#cdd6cd"/></svg>`;host.innerHTML=svg;
}
function drawDirections(rows){
 $('directionChart').innerHTML=GRADES.map(g=>{const group=rows.filter(r=>r.grade===g);const segments=DIRS.map(d=>{const n=group.filter(r=>r.primary===d).length;if(!n)return '';const share=n/group.length*100;return `<button class="${d==='待定'?'grey':''}" data-matrix-grade="${g}" data-matrix-direction="${esc(d)}" style="width:${share}%;background:${DCOL[d]}" title="${esc(g)}组 · ${esc(d)}：${n}/${group.length}位（${pct(n,group.length)}）" aria-label="筛选${esc(g)}组${esc(d)}，${n}位">${share>=16?pct(n,group.length):''}</button>`}).join('');return `<div class="direction-row"><span>${g}</span><div class="stacked-track">${segments}</div><span class="count">${group.length}位</span></div>`}).join('');
}
function drawInsights(rows){
 const dated=rows.filter(r=>fieldDate(r)),daily={};dated.forEach(r=>{const d=fieldDate(r);daily[d]=(daily[d]||0)+1});
 const peaks=Object.entries(daily).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 $('peakInsight').textContent=peaks.length?`${state.dateMode==='availability'?'可发布档期':'拟发布日期'}最集中：${peaks.slice(0,3).map(([d,n])=>`${short(d)} ${n}位`).join('，')}。最高单日占已填该日期人数的${pct(peaks[0][1],dated.length)}。`:state.dateMode==='planned'?'尚未填写拟发布日期。先排日期，再检查是否扎堆。':'当前条件下没有已填档期的达人。';
 const missing=rows.filter(r=>!r.availability).length,pending=rows.filter(r=>r.primary==='待定').length,planned=rows.filter(r=>r.planned).length;
 const scene=rows.filter(r=>['时间压缩','最小底妆','移动底妆','局部修补'].includes(r.primary));
 const covered=new Set(scene.map(r=>r.primary));
 $('pendingInsight').textContent=`${missing}位档期待补，${pending}位主方向待定；已拟排${planned}位。当前四个场景母题覆盖${covered.size}/4，先看真实供给，不强补测评比例。`;
}
function drawTable(){
 const rows=tableRows(),base=filtered();$('listCount').textContent=`${rows.length}位${rows.length!==base.length?`／当前条件${base.length}位`:''}`;
 $('tableEmpty').hidden=rows.length>0;
 let html='';let lastGrade='';
 for(const r of rows){
  if(r.grade!==lastGrade){lastGrade=r.grade;const g=rows.filter(x=>x.grade===r.grade);html+=`<tr class="group-row"><td colspan="9"><strong>${esc(r.grade)}组 · ${g.length}位</strong>待排期 ${g.filter(x=>!x.planned).length}位 · 主方向待定 ${g.filter(x=>x.primary==='待定').length}位</td></tr>`}
  const url=safeUrl(r.url),outcomeClass=r.outcome==='有初步信号'?'positive':r.outcome==='需要复测'?'retest':r.outcome==='本次不适配'?'negative':'wait';
  html+=`<tr data-record="${esc(r.id)}"><td><input type="checkbox" data-select="${esc(r.id)}" ${r.selected?'checked':''} aria-label="将${esc(r.name)}纳入本轮测试"></td><td class="name">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="打开${esc(r.name)}蒲公英主页">${esc(r.name)}</a>`:`<strong>${esc(r.name)}</strong>`}<small>${esc([r.skin,r.tone].filter(Boolean).join(' · ')||'肤质／肤色待补')}</small></td><td><span class="tag grade-${gradeClass(r.grade)}">${esc(r.grade)}</span></td><td>${r.primary==='待定'?'<span class="tag wait">待定</span>':esc(r.primary)}${r.directions.length>1?`<small style="display:block;color:#7c867f;font-size:10px;margin-top:3px" title="${esc(r.directions.join('、'))}">${esc(r.sourcePrimaryNote||"原表多方向")}</small>`:''}</td><td class="date-cell">${r.availability?`${short(r.availability)}<small style="color:#9aa39c;margin-left:3px">${esc(r.availability.slice(0,4))}</small>`:'<span class="amber">待确认</span>'}</td><td><input class="plan-input" data-plan="${esc(r.id)}" type="date" value="${esc(r.planned)}" aria-label="${esc(r.name)}拟发布日期"></td><td><span class="tag neutral">${esc(r.production)}</span></td><td><span class="tag ${outcomeClass}">${esc(r.outcome)}</span>${r.conclusion?'<small style="display:block;color:#7b8b7d;font-size:10px;margin-top:3px">已有文字记录</small>':''}</td><td class="actions"><button data-edit="${esc(r.id)}">编辑与结论</button></td></tr>`;
 }
 $('creatorBody').innerHTML=html;const selected=rows.filter(r=>r.selected).length;$('selectVisible').checked=rows.length>0&&selected===rows.length;$('selectVisible').indeterminate=selected>0&&selected<rows.length;
}
function drawFunnel(){
 const initial=Number(dataset.initialCount)||138,screened=dataset.records.filter(r=>r.stage==='初筛').length,reached=connected().length;
 $('funnelSummary').innerHTML=`<span class="funnel-summary-item"><b>${initial}</b>初始</span><span class="funnel-summary-item"><b>${screened}</b>初筛标记</span><span class="funnel-summary-item"><b>${reached}</b>已建联</span>`;
 $('funnelBody').innerHTML=[['初始来源人数',initial,1],['表内初筛标记',screened,.8],['已建联',reached,.6]].map(([label,n,alpha])=>`<div class="funnel-step"><span>${label}</span><div class="funnel-track"><div style="width:${Math.min(100,n/initial*100)}%;opacity:${alpha}"></div></div><em>${n}人</em></div>`).join('')+`<div class="funnel-step"><span>最终合作</span><div class="funnel-track" style="background:repeating-linear-gradient(135deg,#f1f3ef 0,#f1f3ef 5px,#fafbf9 5px,#fafbf9 10px)"></div><em>待定</em></div><p class="funnel-note">初始${initial}人由你提供；当前表内${dataset.records.length}条，差异待核对。初筛按“合作进度＝初筛”统计，不等于已确认通过；未提供单独复筛字段，因此不虚构复筛人数。最终合作结果暂不统计。此漏斗不随上方排期筛选缩小。</p>`;
}
function resetFilters(){Object.assign(state,{grade:'',direction:'',datePreset:'all',from:'',to:'',search:'',selectedOnly:false,tab:'all'});hideTooltip();render()}
function openEditor(id){
 const row=connected().find(r=>r.id===id);if(!row)return;editingId=id;
 $('editorName').textContent=row.name;$('sourceRecord').innerHTML=`<b>${esc(row.grade)}组</b> · 原表方向：${esc(row.directions.join('、')||'未填写')}<br>可发布档期：${esc(row.availability||'未填写')} · ${esc([row.skin,row.tone].filter(Boolean).join('／')||'肤质与肤色待补')}<br>${esc(row.memo||'原表暂无备注')}${safeUrl(row.url)?`<br><a href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">查看蒲公英主页</a>`:''}`;
 $('editSelected').checked=row.selected;$('editPrimary').value=row.primary;$('editPlanned').value=row.planned;$('editProduction').value=row.production;$('editOutcome').value=row.outcome;$('editHypothesis').value=row.hypothesis;$('editConclusion').value=row.conclusion;$('editNote').value=row.note;editorWarning();$('editor').showModal();
}
function editorWarning(){
 const row=connected().find(r=>r.id===editingId);if(!row)return;const messages=[];
 if($('editPlanned').value&&row.availability&&$('editPlanned').value!==row.availability)messages.push('拟发布日期与原表档期不同，请先与达人确认。');
 if($('editPrimary').value!=='待定'&&!row.directions.includes($('editPrimary').value))messages.push('该主方向不在原标签中，需要确认达人创作意愿和素材。');
 if($('editPrimary').value!==row.primary&&['已拍待初稿','待修改','待发布','已发布'].includes($('editProduction').value))messages.push('内容已进入拍摄后阶段，换主方向可能需要补拍；不要把已拍内容当作可自由调整。');
 $('editorWarning').hidden=!messages.length;$('editorWarning').textContent=messages.join(' ');
}
function showInfo(){
 $('infoContent').innerHTML='<h3>两份飞书表分工</h3><p>原达人筛选表只读取评级、创作方向、建联状态和可发布档期。拟发布日期、制作状态、测试结论和备注保存到新的独立飞书协作表。</p><h3>共享保存</h3><p>点击保存后显示“已保存到飞书”才代表提交成功。其他获准访问的同事刷新后可看到。页面打开时自动同步，保持打开时每5分钟刷新；关闭页面后不执行后台任务。</p><h3>保留排期</h3><p>同步来源不覆盖已填写的拟发布日期和测试结论。来源方向变化时更新主方向。原筛选表不会被回写，复制表中未建联及历史记录也不会被删除。</p><h3>迁移原HTML记录</h3><p>从原HTML导出JSON备份，然后用本页“导入本地备份”把排期写入新飞书表。按达人名称或标识匹配，不把共享名单恢复成旧快照。</p><h3>当前口径</h3><p>原始来源138人由你提供，初筛按原表标记计算，不等于最终通过。未提供复筛字段及最终合作结果，保持待定。</p>';
 $('info').showModal();
}
function showTooltip(bucket,e){const tip=$('tooltip');tip.innerHTML=`<div class="tooltip-title">${esc(bucket.key)}${state.grain==='week'?`—${short(bucket.end)}`:''}</div>`+GRADES.filter(g=>bucket.counts[g]).map(g=>`<div class="tooltip-row"><i class="swatch" style="background:${GCOL[g]}"></i>${g}<b>${bucket.counts[g]}位</b></div>`).join('')+`<div class="tooltip-row" style="border-top:1px solid #e0e5df;margin-top:5px;padding-top:5px">合计<b>${bucket.rows.length}位</b></div><div class="tooltip-names">${esc(bucket.rows.slice(0,6).map(r=>r.name).join('、'))}${bucket.rows.length>6?'等':''}<br>点击筛选此时段</div>`;tip.hidden=false;const rect=tip.getBoundingClientRect(),x=Math.min(window.innerWidth-rect.width-12,Math.max(10,(e.clientX||100)+14)),y=Math.min(window.innerHeight-rect.height-12,Math.max(10,(e.clientY||100)+14));tip.style.left=`${x}px`;tip.style.top=`${y}px`}
function hideTooltip(){$('tooltip').hidden=true}
function focusBucket(i){const b=state.buckets[i];if(!b||!b.rows.length)return;state.datePreset='custom';state.from=b.key;state.to=b.end;hideTooltip();render()}
function download(name,text,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csvCell(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
function exportCsv(){const h=['达人','评级','原表方向','排期主方向','可发布档期','拟发布日期','纳入本轮测试','制作状态','测试结论状态','测试假设','实际结果与下一步','排期备注','肤质','肤色','蒲公英链接'];const rows=tableRows().map(r=>[r.name,r.grade,r.directions.join('、'),r.primary,r.availability,r.planned,r.selected?'是':'否',r.production,r.outcome,r.hypothesis,r.conclusion,r.note,r.skin,r.tone,r.url]);download(`简可思达人排期_${new Date().toISOString().slice(0,10)}.csv`,'\uFEFF'+[h,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast(`已导出当前名单${rows.length}位`)}
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw new Error('CSV引号不完整，请重新导出。');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows}
function normalizeCsv(text){const rows=parseCsv(text.replace(/^\uFEFF/,''));if(rows.length<2)throw new Error('CSV没有可用数据。');const headers=rows[0].map(x=>x.trim());for(const key of ['达人id','建联进度','优先级','创作方向','档期'])if(!headers.includes(key))throw new Error(`缺少飞书字段“${key}”，请导出原始达人表CSV。`);const get=(r,k)=>(r[headers.indexOf(k)]||'').trim();const recs=rows.slice(1).filter(r=>get(r,'达人id')).map((r,i)=>{const ds=get(r,'创作方向').split(/[,，、]/).map(x=>x.trim()).filter(Boolean).map(x=>({'横向测评':'同品类对比','纵向测评':'跨品类对比'}[x]||x));const raw=get(r,'档期');let d='';if(/^\d{5}(\.0)?$/.test(raw))d=iso(new Date((Number(raw)-25569)*86400000));else if(raw){const m=raw.match(/(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/);if(m)d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;else throw new Error(`“${get(r,'达人id')}”档期格式无法识别，请使用含年份的日期。`)}const name=get(r,'达人id'),verified=dataset.records.find(x=>x.name===name&&x.primaryReviewed&&ds.includes(x.sourcePrimary));return {id:get(r,'蒲公英链接')||`name:${name}`,name,grade:get(r,'优先级')||'未评级',stage:get(r,'合作进度'),contact:get(r,'建联进度'),directions:verified?[verified.sourcePrimary]:ds,sourceDirections:ds,sourcePrimary:ds.length===1?ds[0]:verified?verified.sourcePrimary:'待定',primaryReviewed:!!verified,sourcePrimaryNote:verified?.sourcePrimaryNote||'',availability:d,skin:get(r,'肤质'),tone:get(r,'肤色'),accountType:get(r,'账号类型'),fans:Number(get(r,'粉丝数'))||null,url:verified?.url||get(r,'蒲公英链接'),memo:get(r,'备注'),sourceRow:i+2}});if(new Set(recs.map(r=>r.id)).size!==recs.length)throw new Error('CSV含重复达人标识，请先核对原表，避免重复统计。');return recs}
function cleanPatches(input,recs){const result={};const ids=new Set(recs.map(r=>r.id));for(const [id,p]of Object.entries(input||{})){if(!ids.has(id)||!p||typeof p!=='object')continue;const entry={};if(DIRS.includes(p.primary))entry.primary=p.primary;for(const key of ['hypothesis','conclusion','note'])if(typeof p[key]==='string')entry[key]=p[key].slice(0,20000);if(typeof p.planned==='string'&&(!p.planned||parseDate(p.planned)))entry.planned=p.planned;if(PRODUCTION.includes(p.production))entry.production=p.production;if(OUTCOMES.includes(p.outcome))entry.outcome=p.outcome;entry.selected=p.selected===true;result[id]=entry}return result}
function validRecords(records){return Array.isArray(records)&&records.length>0&&records.length<=10000&&records.every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&Array.isArray(r.directions)&&(!r.availability||parseDate(r.availability)))}

$('gradeFilter').addEventListener('change',e=>{state.grade=e.target.value;render()});
$('directionFilter').addEventListener('change',e=>{state.direction=e.target.value;render()});
$('datePreset').addEventListener('change',e=>{state.datePreset=e.target.value;render()});
$('dateFrom').addEventListener('change',e=>{state.from=e.target.value;render()});$('dateTo').addEventListener('change',e=>{state.to=e.target.value;render()});
$('search').addEventListener('input',e=>{state.search=e.target.value;render()});
$('selectedOnly').addEventListener('change',e=>{state.selectedOnly=e.target.checked;render()});
$('resetFilters').addEventListener('click',resetFilters);$('emptyReset').addEventListener('click',resetFilters);
$('modeAvailability').addEventListener('click',()=>{state.dateMode='availability';render()});$('modePlanned').addEventListener('click',()=>{state.dateMode='planned';render()});
$('byDay').addEventListener('click',()=>{state.grain='day';render()});$('byWeek').addEventListener('click',()=>{state.grain='week';render()});
$('directionChart').addEventListener('click',e=>{const b=e.target.closest('[data-matrix-grade]');if(b){state.grade=b.dataset.matrixGrade;state.direction=b.dataset.matrixDirection;render()}});
$('directionLegend').addEventListener('click',e=>{const b=e.target.closest('[data-direction]');if(b){state.direction=b.dataset.direction;render()}});
$('histogram').addEventListener('pointermove',e=>{const target=e.target.closest('[data-bucket]');if(target)showTooltip(state.buckets[Number(target.dataset.bucket)],e);else hideTooltip()});$('histogram').addEventListener('pointerleave',hideTooltip);
$('histogram').addEventListener('click',e=>{const target=e.target.closest('[data-bucket]');if(target)focusBucket(Number(target.dataset.bucket))});
$('histogram').addEventListener('keydown',e=>{const t=e.target.closest('[data-bucket]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();focusBucket(Number(t.dataset.bucket))}});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;drawTable();document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===state.tab))}));
$('creatorBody').addEventListener('click',e=>{const button=e.target.closest('[data-edit]');if(button)openEditor(button.dataset.edit)});
$('creatorBody').addEventListener('change',e=>{if(e.target.dataset.select)updatePatch(e.target.dataset.select,{selected:e.target.checked});if(e.target.dataset.plan){const id=e.target.dataset.plan,r=connected().find(x=>x.id===id),planned=e.target.value;updatePatch(id,{planned},planned&&r.availability&&planned!==r.availability?'已保存拟排日期；与原档期不同，需另行确认。':'已保存至新飞书协作表')}});
$('selectVisible').addEventListener('change',async e=>{const selected=e.target.checked;const entries=tableRows().filter(r=>r.selected!==selected).map(r=>({id:r.id,changes:{selected},expectedUpdatedAt:patches[r.id]?.remoteUpdatedAt||0}));await persistEntries(entries,'本轮测试名单已保存到新飞书表。')});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
for(const id of ['editPrimary','editPlanned','editProduction'])$(id).addEventListener('change',editorWarning);
$('editorForm').addEventListener('submit',async e=>{e.preventDefault();if(!editingId)return;const saved=await updatePatch(editingId,{primary:$('editPrimary').value,planned:$('editPlanned').value,production:$('editProduction').value,outcome:$('editOutcome').value,hypothesis:$('editHypothesis').value.trim(),conclusion:$('editConclusion').value.trim(),note:$('editNote').value.trim(),selected:$('editSelected').checked},'已保存至新飞书协作表');if(saved)$('editor').close()});
$('showInfo').addEventListener('click',showInfo);$('infoContent').addEventListener('change',e=>{if(e.target.id==='initialCountInput'){const n=Number(e.target.value);if(n>=1&&n<=100000){dataset.initialCount=n;save();drawFunnel()}else toast('请输入有效的初始人数。')}});
$('exportCsv').addEventListener('click',exportCsv);
$('backup').addEventListener('click',()=>{download(`简可思排期备份_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:1,dataset,patches,embeddedRevision:SEED.sourceRevision||SEED.snapshotDate,exportedAt:new Date().toISOString()},null,2),'application/json;charset=utf-8');toast('备份包含共享排期、测试名单和结论，可导入另一台电脑。')});
$('importData').addEventListener('click',()=>{$('fileInput').value='';$('fileInput').click()});
$('fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('备份文件超过10MB。');const parsed=JSON.parse(await file.text());if(parsed.version!==1||!validRecords(parsed.dataset?.records))throw new Error('请使用原HTML网页导出的JSON排期备份。');const matched=mergePatches(parsed.patches,parsed.dataset.records,dataset.records);const entries=Object.entries(matched).filter(([id])=>connected().some(r=>r.id===id)).map(([id,p])=>({id,changes:Object.fromEntries(editableKeys.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]])),expectedUpdatedAt:patches[id]?.remoteUpdatedAt||0})).filter(e=>Object.keys(e.changes).length);if(!entries.length)throw new Error('备份里没有可匹配的排期修改。');if(!confirm(`将把备份中${entries.length}位达人的排期写入新的飞书协作表，保留当前达人名单。确认导入吗？`))return;await persistEntries(entries,'本地备份已迁移到新飞书表。');}catch(error){toast(error.message)}});
$('clearLocal').hidden=true;
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>drawHistogram(filtered()),120)});
installOptions();render();
window.CreatorPlanner={state,filtered,tableRows,connected,getDataset:()=>dataset,getPatches:()=>patches,parseCsv,normalizeCsv,makeBuckets};

async function refreshCloud(manual=false){if(syncBusy||cloudSaving||$('editor').open)return;syncBusy=true;$('cloudSync').disabled=true;try{await cloudRequest('/api/sync',{method:'POST',body:'{}'});const fresh=await cloudRequest('/api/state');if(!fresh.configured)throw new Error('飞书连接尚未完成。');dataset=fresh.dataset;patches=fresh.patches||{};installOptions();render();$('saveState').textContent='飞书已同步';if(manual)toast('已同步原表并刷新独立排期表。');}catch(error){toast(error.message);}finally{syncBusy=false;$('cloudSync').disabled=false;}}
$('cloudSync').addEventListener('click',()=>refreshCloud(true));
const tableLink=document.getElementById('planTableLink');if(tableLink)tableLink.href=dataset.planUrl||'#';
setInterval(()=>{if(!document.hidden)refreshCloud(false)},300000);

})().catch(error=>{const el=document.getElementById('connectionMessage');if(el)el.textContent=error.message;});
