import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,dateMillis,normalizeSource,makeClient,syncSource,saveEntries,validateChanges,PLAN_FIELDS} from '../lib/feishu.mjs';
const env={FEISHU_APP_ID:'testapp',FEISHU_APP_SECRET:'testonly',FEISHU_SOURCE_APP_TOKEN:'source',FEISHU_SOURCE_TABLE_ID:'srctable',FEISHU_PLAN_APP_TOKEN:'dest',FEISHU_PLAN_TABLE_ID:'dsttable'};
function fixture(){
 const writes=[];
 const source=[{record_id:'rec1',fields:{'达人id':'测试达人','建联进度':'已建联','创作方向':['时间压缩'],'档期':dateMillis('2026-10-28')}}];
 const destination=[{record_id:'dst1',fields:{...source[0].fields,'来源记录ID':'rec1','来源方向快照':'局部修补','排期主方向':'局部修补','拟发布日期':dateMillis('2026-10-30'),'排期备注':'保留备注','实际结果与下一步':'保留结论','排期更新时间':101}}];
 const fields=[...['达人id','建联进度','创作方向','档期'].map(field_name=>({field_name,type:1})),...PLAN_FIELDS];
 const fetcher=async(url,options={})=>{
  if(url.includes('/auth/'))return Response.json({code:0,tenant_access_token:'fake-token',expire:7200});
  const dest=url.includes('/apps/dest/'),method=options.method||'GET';
  if(method!=='GET'){assert.ok(dest,'all record and schema writes must target destination');writes.push({url,body:JSON.parse(options.body)});return Response.json({code:0,data:{}})}
  return Response.json({code:0,data:{items:url.includes('/fields')?fields:dest?destination:source,has_more:false}});
 };
 return {fetcher,writes,source,destination};
}
test('rejects a destination pointing to original base',()=>assert.throws(()=>configuration({...env,FEISHU_PLAN_APP_TOKEN:'source'}),/独立/));
test('original source write is rejected before network access',async()=>{let called=false;const request=makeClient(configuration(env).cfg,async()=>{called=true});await assert.rejects(request(false,'/records','POST',{}),/禁止写入/);assert.equal(called,false)});
test('date validation and Shanghai day are preserved',()=>{const n=normalizeSource({record_id:'r',fields:{'档期':dateMillis('2026-10-28')}});assert.equal(n.availability,'2026-10-28');assert.throws(()=>dateMillis('2026-02-30'),/不存在/)});
test('source synchronization updates direction but preserves scheduling and conclusions',async()=>{const f=fixture();const result=await syncSource(env,f.fetcher);assert.equal(result.updated,1);const fields=f.writes[0].body.records[0].fields;assert.equal(fields['排期主方向'],'时间压缩');for(const key of ['拟发布日期','排期备注','实际结果与下一步','排期更新时间'])assert.ok(!(key in fields))});
test('stale edit fails without writing',async()=>{const f=fixture();await assert.rejects(saveEntries(env,[{id:'rec1',expectedUpdatedAt:100,changes:{note:'新备注'}}],'editor@example.test',f.fetcher),/其他人更新/);assert.equal(f.writes.length,0)});
test('saving changes only selected scheduling fields and records editor',async()=>{const f=fixture();const data=await saveEntries(env,[{id:'rec1',expectedUpdatedAt:101,changes:{planned:'2026-10-31',note:'新备注'}}],'editor@example.test',f.fetcher);const fields=f.writes[0].body.records[0].fields;assert.equal(fields['拟发布日期'],dateMillis('2026-10-31'));assert.equal(fields['最近编辑人'],'editor@example.test');assert.ok(!('创作方向' in fields));assert.equal(data.patches.rec1.conclusion,'保留结论')});
test('rejects forged fields and inactive creators',async()=>{assert.throws(()=>validateChanges({grade:'A'}),/仅允许/);const f=fixture();f.source[0].fields['建联进度']='未回复';await assert.rejects(saveEntries(env,[{id:'rec1',expectedUpdatedAt:101,changes:{note:'x'}}],'editor@example.test',f.fetcher),/已不在/);assert.equal(f.writes.length,0)});
test('curation chooses one direction for the reviewed multi-tag creator',()=>assert.equal(normalizeSource({record_id:'r',fields:{'达人id':'0-tingting','创作方向':['局部修补','时间压缩']}}).sourcePrimary,'时间压缩'));
