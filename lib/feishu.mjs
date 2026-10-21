const API='https://open.feishu.cn/open-apis';
export const DIRECTIONS=['时间压缩','最小底妆','移动底妆','局部修补','单品测评','同品类对比','跨品类对比','待定'];
const PRODUCTION=['待确认','待脚本','待拍摄','已拍待初稿','待修改','待发布','已发布'];
const OUTCOMES=['待测试','已发布待观察','有初步信号','需要复测','本次不适配'];
const SOURCE_FIELDS=['合作进度','建联进度','优先级','备注','达人id','账号类型','粉丝数','蒲公英链接','创作方向','肤色','肤质','档期','笔记链接'];
const KEYS=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_SOURCE_APP_TOKEN','FEISHU_SOURCE_TABLE_ID','FEISHU_PLAN_APP_TOKEN','FEISHU_PLAN_TABLE_ID'];
const EDIT_FIELDS={primary:'排期主方向',planned:'拟发布日期',production:'制作状态',outcome:'测试结论状态',hypothesis:'测试假设',conclusion:'实际结果与下一步',note:'排期备注',selected:'本轮测试'};
export const PLAN_FIELDS=[
 {field_name:'来源记录ID',type:1},{field_name:'来源方向快照',type:1},
 {field_name:'排期主方向',type:3,property:{options:DIRECTIONS.map(name=>({name}))}},
 {field_name:'拟发布日期',type:5,property:{date_formatter:'yyyy/MM/dd',auto_fill:false}},
 {field_name:'制作状态',type:3,property:{options:PRODUCTION.map(name=>({name}))}},
 {field_name:'测试结论状态',type:3,property:{options:OUTCOMES.map(name=>({name}))}},
 {field_name:'测试假设',type:1},{field_name:'实际结果与下一步',type:1},{field_name:'排期备注',type:1},{field_name:'本轮测试',type:7},
 {field_name:'最近编辑人',type:1},
 {field_name:'排期更新时间',type:5,property:{date_formatter:'yyyy/MM/dd HH:mm',auto_fill:false}},
 {field_name:'来源同步时间',type:5,property:{date_formatter:'yyyy/MM/dd HH:mm',auto_fill:false}},
];
let tokenCache=null,schemaCache=null;
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const text=v=>v==null?'':Array.isArray(v)?v.map(text).filter(Boolean).join(''):typeof v==='object'?String(v.text??v.name??v.link??v.url??''):String(v).trim();
const choices=v=>Array.isArray(v)?v.map(text).filter(Boolean):text(v).split(/[,，、]/).map(x=>x.trim()).filter(Boolean);
const directions=v=>choices(v).map(x=>({'横向测评':'同品类对比','纵向测评':'跨品类对比'}[x]||x));
function primaryOf(name,tags){if(tags.length===1)return tags[0];if(name==='0-tingting'&&tags.includes('时间压缩'))return '时间压缩';return '待定';}
function dateString(v){if(!v)return '';if(typeof v==='number')return new Date(v+28800000).toISOString().slice(0,10);const s=text(v);return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'';}
export function dateMillis(s){if(!s)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new AppError('日期格式应为年-月-日。');const t=Date.parse(s+'T00:00:00+08:00');if(!Number.isFinite(t)||dateString(t)!==s)throw new AppError('日期不存在，请重新选择。');return t;}
export function configuration(env){
 const missing=KEYS.filter(k=>!env[k]);if(missing.length)return {configured:false,missing};
 const cfg={appId:env.FEISHU_APP_ID,appSecret:env.FEISHU_APP_SECRET,sourceApp:env.FEISHU_SOURCE_APP_TOKEN,sourceTable:env.FEISHU_SOURCE_TABLE_ID,planApp:env.FEISHU_PLAN_APP_TOKEN,planTable:env.FEISHU_PLAN_TABLE_ID,sourceUrl:env.FEISHU_SOURCE_URL||'',planUrl:env.FEISHU_PLAN_URL||''};
 if(cfg.sourceApp===cfg.planApp)throw new AppError('排期必须保存在独立多维表格，不能指向原表。',503);
 for(const s of [cfg.sourceApp,cfg.planApp,cfg.sourceTable,cfg.planTable])if(!/^[A-Za-z0-9]+$/.test(s))throw new AppError('飞书表格标识格式不正确。',503);
 return {configured:true,cfg};
}
async function accessToken(cfg,fetcher){
 if(tokenCache&&tokenCache.appId===cfg.appId&&tokenCache.until>Date.now())return tokenCache.token;
 const res=await fetcher(API+'/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:cfg.appId,app_secret:cfg.appSecret})});
 const data=await res.json();if(!res.ok||data.code!==0||!data.tenant_access_token)throw new AppError('飞书应用认证尚未通过，请检查应用发布状态和服务器密钥。',503);
 tokenCache={appId:cfg.appId,token:data.tenant_access_token,until:Date.now()+Math.max(60,(Number(data.expire)||7200)-120)*1000};return tokenCache.token;
}
function tablePath(cfg,destination){return `/bitable/v1/apps/${destination?cfg.planApp:cfg.sourceApp}/tables/${destination?cfg.planTable:cfg.sourceTable}`;}
export function makeClient(cfg,fetcher=fetch){return async function request(destination,path,method='GET',body){
 if(!destination&&method!=='GET')throw new AppError('禁止写入原达人筛选表。',403);
 const token=await accessToken(cfg,fetcher),url=API+tablePath(cfg,destination)+path;
 const res=await fetcher(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await res.json();}catch{throw new AppError('飞书暂时没有返回有效结果，请稍后重试。',502);}
 if(!res.ok||data.code!==0){if([99991663,99991668].includes(data.code))tokenCache=null;throw new AppError(`飞书接口未完成（${data.code??res.status}），请检查应用权限及两份表的文档应用授权。`,502);}return data.data||{};
};}
async function list(client,dest,path){let items=[],page='';for(let i=0;i<100;i++){const d=await client(dest,path+`?page_size=500${page?'&page_token='+encodeURIComponent(page):''}`);items.push(...(d.items||[]));if(!d.has_more)return items;if(!d.page_token)throw new AppError('飞书分页结果不完整。',502);page=d.page_token;}throw new AppError('记录数量超过当前处理范围。',413);}
async function fields(client,dest){let result=[],page='';for(let i=0;i<30;i++){const d=await client(dest,`/fields?page_size=100${page?'&page_token='+encodeURIComponent(page):''}`);result.push(...(d.items||[]));if(!d.has_more)return result;page=d.page_token;}throw new AppError('字段分页结果不完整。',502);}
export function normalizeSource(r,i=0){const f=r.fields||{},name=text(f['达人id']),tags=directions(f['创作方向']),raw=f['蒲公英链接'];const url=typeof raw==='object'&&!Array.isArray(raw)?raw?.link||raw?.url||'':text(raw);return {id:r.record_id,name,grade:text(f['优先级'])||'未评级',stage:text(f['合作进度']),contact:text(f['建联进度']),directions:tags,sourcePrimary:primaryOf(name,tags),availability:dateString(f['档期']),skin:text(f['肤质']),tone:text(f['肤色']),accountType:text(f['账号类型']),fans:Number(text(f['粉丝数']))||null,url:/^https:\/\//.test(url)?url:'',memo:text(f['备注']),sourceRow:i+2};}
function patchFrom(r){const f=r.fields||{};return {primary:text(f['排期主方向'])||undefined,planned:dateString(f['拟发布日期']),production:text(f['制作状态'])||'待确认',outcome:text(f['测试结论状态'])||'待测试',hypothesis:text(f['测试假设']),conclusion:text(f['实际结果与下一步']),note:text(f['排期备注']),selected:f['本轮测试']===true,remoteUpdatedAt:Number(f['排期更新时间'])||0,lastEditor:text(f['最近编辑人'])};}
function destinationMap(records){const byId=new Map(),byName=new Map();for(const r of records){const id=text(r.fields?.['来源记录ID']),name=text(r.fields?.['达人id']);if(id){if(byId.has(id))throw new AppError('新表出现重复来源ID，请先核对。',409);byId.set(id,r);}if(name){if(byName.has(name))byName.set(name,null);else byName.set(name,r);}}return {byId,byName};}
function related(maps,r){if(maps.byId.has(r.record_id))return maps.byId.get(r.record_id);const name=text(r.fields?.['达人id']);if(maps.byName.has(name)&&maps.byName.get(name)===null)throw new AppError(`新表中“${name}”有重名记录，请先核对。`,409);return maps.byName.get(name);}
export async function readState(env,fetcher=fetch){
 const status=configuration(env);if(!status.configured)return {configured:false,missing:status.missing,sourceUrl:env.FEISHU_SOURCE_URL||'',planUrl:env.FEISHU_PLAN_URL||''};
 const client=makeClient(status.cfg,fetcher),[source,dest]=await Promise.all([list(client,false,'/records'),list(client,true,'/records')]),maps=destinationMap(dest),patches={};
 const records=source.filter(r=>text(r.fields?.['达人id'])).map((r,i)=>{const n=normalizeSource(r,i),d=related(maps,r);if(d){const p=patchFrom(d),oldDirection=text(d.fields?.['来源方向快照']);if(oldDirection&&oldDirection!==n.directions.join('、'))p.primary=n.sourcePrimary;patches[n.id]=p;}return n;});
 return {configured:true,dataset:{version:1,sourceTitle:'达人筛选（原表只读）',sourceUrl:status.cfg.sourceUrl,planUrl:status.cfg.planUrl,snapshotDate:dateString(Date.now()),initialCount:138,dateMeaning:'可发布档期',records},patches,readAt:new Date().toISOString()};
}
async function ensureSchema(cfg,client){if(schemaCache?.key===cfg.planApp+cfg.planTable&&schemaCache.until>Date.now())return;const existing=await fields(client,true),byName=new Map(existing.map(f=>[f.field_name,f]));for(const definition of PLAN_FIELDS){const old=byName.get(definition.field_name);if(old&&old.type!==definition.type)throw new AppError(`新表字段“${definition.field_name}”类型不匹配。`,409);if(!old)await client(true,'/fields','POST',definition);}schemaCache={key:cfg.planApp+cfg.planTable,until:Date.now()+600000};}
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export async function syncSource(env,fetcher=fetch){
 const status=configuration(env);if(!status.configured)throw new AppError('请先完成飞书应用连接。',503);const {cfg}=status,client=makeClient(cfg,fetcher);await ensureSchema(cfg,client);
 const [source,dest,srcFields,dstFields]=await Promise.all([list(client,false,'/records'),list(client,true,'/records'),fields(client,false),fields(client,true)]);
 const maps=destinationMap(dest),sourceSet=new Set(srcFields.map(f=>f.field_name)),destSet=new Set(dstFields.map(f=>f.field_name)),updates=[],creates=[];let connected=0;
 for(const r of source){if(!text(r.fields?.['达人id']))continue;const n=normalizeSource(r),d=related(maps,r);if(n.contact==='已建联')connected++;if(!d&&n.contact!=='已建联')continue;const changed={};
  for(const k of SOURCE_FIELDS)if(sourceSet.has(k)&&destSet.has(k)&&(!d||!equal(d.fields?.[k],r.fields?.[k])))changed[k]=r.fields?.[k]??null;
  if(!d||text(d.fields?.['来源记录ID'])!==r.record_id)changed['来源记录ID']=r.record_id;
  const direction=n.directions.join('、');if(!d||text(d.fields?.['来源方向快照'])!==direction){changed['来源方向快照']=direction;changed['排期主方向']=n.sourcePrimary;}else if(!text(d.fields?.['排期主方向']))changed['排期主方向']=n.sourcePrimary;
  if(!d){changed['制作状态']='待确认';changed['测试结论状态']='待测试';changed['本轮测试']=false;}
  if(Object.keys(changed).length){changed['来源同步时间']=Date.now();if(d)updates.push({record_id:d.record_id,fields:changed});else creates.push({fields:changed});}
 }
 for(let i=0;i<updates.length;i+=100)await client(true,'/records/batch_update','POST',{records:updates.slice(i,i+100)});for(let i=0;i<creates.length;i+=100)await client(true,'/records/batch_create','POST',{records:creates.slice(i,i+100)});
 return {updated:updates.length,created:creates.length,connected,syncedAt:new Date().toISOString()};
}
export function validateChanges(changes){if(!changes||typeof changes!=='object'||Array.isArray(changes))throw new AppError('修改内容格式不正确。');const result={};for(const [key,value]of Object.entries(changes)){
 if(!Object.hasOwn(EDIT_FIELDS,key))throw new AppError('仅允许修改排期字段，不能修改原筛选资料。',403);if(key==='selected'){if(typeof value!=='boolean')throw new AppError('测试名单值不正确。');result[key]=value;continue;}
 if(typeof value!=='string'||value.length>20000)throw new AppError('字段内容过长或格式不正确。');if(key==='primary'&&!DIRECTIONS.includes(value))throw new AppError('创作方向不在可选范围。');if(key==='production'&&!PRODUCTION.includes(value))throw new AppError('制作状态不在可选范围。');if(key==='outcome'&&!OUTCOMES.includes(value))throw new AppError('测试状态不在可选范围。');if(key==='planned')dateMillis(value);result[key]=value;
 }if(!Object.keys(result).length)throw new AppError('没有需要保存的修改。');return result;}
export async function saveEntries(env,entries,actor,fetcher=fetch){
 const status=configuration(env);if(!status.configured)throw new AppError('请先完成飞书应用连接。',503);if(!actor)throw new AppError('请先登录工作台。',401);
 if(!Array.isArray(entries)||entries.length<1||entries.length>100||new Set(entries.map(x=>x.id)).size!==entries.length)throw new AppError('保存名单为空、重复或超过100位。');const checked=entries.map(e=>({...e,changes:validateChanges(e.changes)})),client=makeClient(status.cfg,fetcher);
 const [source,dest]=await Promise.all([list(client,false,'/records'),list(client,true,'/records')]),maps=destinationMap(dest),sourceMap=new Map(source.map(r=>[r.record_id,r])),updates=[],result={},now=Date.now();
 for(const e of checked){const original=sourceMap.get(e.id);if(!original||text(original.fields?.['建联进度'])!=='已建联')throw new AppError('达人已不在当前已建联名单，请刷新后再安排。',409);const d=related(maps,original);if(!d||!text(d.fields?.['来源记录ID']))throw new AppError('请先同步来源，建立新表中的排期记录。',409);const old=patchFrom(d);
  if(!Number.isFinite(e.expectedUpdatedAt)||e.expectedUpdatedAt!==old.remoteUpdatedAt)throw new AppError('这位达人的排期刚被其他人更新，请刷新后查看再保存。',409);const f={};for(const [key,value]of Object.entries(e.changes))f[EDIT_FIELDS[key]]=key==='planned'?dateMillis(value):value;f['最近编辑人']=actor;f['排期更新时间']=Math.max(now,old.remoteUpdatedAt+1);updates.push({record_id:d.record_id,fields:f});result[e.id]={...old,...e.changes,lastEditor:actor,remoteUpdatedAt:f['排期更新时间']};
 }
 await client(true,'/records/batch_update','POST',{records:updates});return {patches:result,savedAt:new Date().toISOString()};
}
