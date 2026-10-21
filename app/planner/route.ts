import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {PLANNER_HTML} from '../../lib/planner-html';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.redirect(new URL(chatGPTSignInPath('/planner'),request.url),302);
 return new Response(PLANNER_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}
