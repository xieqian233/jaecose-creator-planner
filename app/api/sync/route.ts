import {env} from 'cloudflare:workers';
import {authorize,apiError,result} from '../../../lib/api';
import {syncSource} from '../../../lib/feishu.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){const auth=await authorize(request,true);if(auth.response)return auth.response;try{return result(await syncSource(env));}catch(error){return apiError(error);}}
