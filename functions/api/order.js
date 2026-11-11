import {json,BOOKS,verifySquareOrder} from '../../server/square.js';
import {signToken,sendEmail,esc} from '../../server/lib.js';
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
 // Send only after Square payment verification. The recovery URL rechecks Square
 // on every visit; it is not a direct, permanent file URL.
 if(order.email&&env.RESEND_API_KEY&&env.NOTIFY_EMAIL_FROM&&env.NOTIFIED){
  waitUntil((async()=>{
   const flag='square:ebook-email-sent:'+ref;
   if(await env.NOTIFIED.get(flag))return;
   const recover= new URL('/?square_ref='+encodeURIComponent(ref)+'#success',request.url).toString();
   const titles=order.items.map(k=>esc(BOOKS[k].title)).join(', ');
   await sendEmail(env,{to:order.email,subject:'Your Impavid ebooks — receipt and download access',
    html:'<h2>Thank you for your purchase</h2><p>Your ebooks: '+titles+'</p><p><a href="'+esc(recover)+'">Open your purchase and download your ebooks</a></p><p>This link allows you to return for fresh download buttons. On iPhone, save the EPUB to Files and open it in Apple Books. On Android, find it in Downloads and open it with an EPUB reader.</p><p>Need help? support@theimpavid.com</p>'});
   await env.NOTIFIED.put(flag,'1',{expirationTtl:60*60*24*90});
  })().catch(e=>console.error('Ebook email delivery failed',e.message)));
 }

 return json({paid:true,kind:'books',downloads});
}