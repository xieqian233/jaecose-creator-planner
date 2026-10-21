import {env} from 'cloudflare:workers';
import {authorize,apiError,result} from '../../../lib/api';
import {readState} from '../../../lib/feishu.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){const auth=await authorize(request);if(auth.response)return auth.response;try{return result(await readState(env));}catch(error){return apiError(error);}}
