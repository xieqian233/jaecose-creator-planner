import {env} from 'cloudflare:workers';
import {authorize,apiError,result} from '../../../lib/api';
import {saveEntries} from '../../../lib/feishu.mjs';
export const dynamic='force-dynamic';
export async function PATCH(request:Request){const auth=await authorize(request,true);if(auth.response)return auth.response;try{const text=await request.text();if(text.length>300000)return Response.json({error:'修改内容过大，请分次保存。'},{status:413});return result(await saveEntries(env,JSON.parse(text).entries,auth.user!.email));}catch(error){return apiError(error);}}
