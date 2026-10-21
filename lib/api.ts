import {getChatGPTUser} from '../app/chatgpt-auth';
export async function authorize(request:Request,write=false){
 const user=await getChatGPTUser();if(!user)return {user:null,response:Response.json({error:'请先登录工作台。'},{status:401,headers:{'Cache-Control':'no-store'}})};
 if(write){const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return {user:null,response:Response.json({error:'请求来源不正确。'},{status:403})};if(!request.headers.get('Content-Type')?.includes('application/json'))return {user:null,response:Response.json({error:'仅接受JSON请求。'},{status:415})};}return {user,response:null};
}
export function apiError(error:unknown){const e=error as {status?:number,message?:string};return Response.json({error:e.message||'连接暂时不可用，请稍后重试。'},{status:e.status||502,headers:{'Cache-Control':'no-store'}});}
export function result(data:unknown){return Response.json(data,{headers:{'Cache-Control':'no-store'}});}
