import {json,BOOKS,verifySquareOrder} from '../../server/square.js';
import {signToken} from '../../server/lib.js';
import {notifyConsultation} from '../../server/notify.js';
export async function onRequestGet({request,env,waitUntil}){
 const ref=new URL(request.url).searchParams.get('square_ref');
 if(!/^[0-9a-f-]{36}$/i.test(ref||''))return json({paid:false,error:'Invalid Square order reference.'},400);
 let order;try{order=await verifySquareOrder(env,ref)}catch(e){console.error(e.message);return json({paid:false,error:'Square verification unavailable.'},502)}
 if(!order)return json({paid:false,error:'Square has not confirmed payment yet.'},202);
 if(order.kind==='consultation'){
  waitUntil(notifyConsultation(env,ref,order).catch(e=>console.error('Square consultation notification failed',e.message)));
  return json({paid:true,kind:'consultation',category:order.category_label,package:order.package_label});
 }
 if(order.kind!=='books'||!Array.isArray(order.items)||!order.items.length||order.items.some(k=>!BOOKS[k]))return json({paid:false,error:'Unrecognized order.'},422);
 if(!env.DOWNLOAD_SIGNING_SECRET)return json({paid:false,error:'Download signing secret unavailable in this deployment.',code:'MISSING_DOWNLOAD_SIGNING_SECRET'},503);
 if(!env.BOOKS)return json({paid:false,error:'R2 ebook binding unavailable in this deployment.',code:'MISSING_BOOKS_BINDING'},503);
 for(const key of order.items){if(!env[BOOKS[key].key]||!(await env.BOOKS.head(env[BOOKS[key].key])))return json({paid:false,error:'Payment confirmed, ebook unavailable. Contact support@theimpavid.com.'},503)}
 const expires=Math.floor(Date.now()/1000)+900;
 const downloads=await Promise.all(order.items.map(async key=>({title:BOOKS[key].title,url:'/api/download?t='+encodeURIComponent(await signToken(env,{s:ref,b:key,e:expires}))})));
 return json({paid:true,kind:'books',downloads});
}