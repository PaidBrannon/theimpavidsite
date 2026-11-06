import {json,square,verifySquareOrder} from '../../server/square.js';
import {notifyConsultation} from '../../server/notify.js';
const enc=new TextEncoder();
async function validSignature(key,url,body,provided){
 if(!key||!url||!provided)return false;
 const cryptoKey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',cryptoKey,enc.encode(url+body)));
 const expected=btoa(String.fromCharCode(...signature));
 if(expected.length!==provided.length)return false;
 let difference=0;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^provided.charCodeAt(i);
 return difference===0;
}
export async function onRequestPost({request,env,waitUntil}){
 if(!env.SQUARE_WEBHOOK_SIGNATURE_KEY||!env.SQUARE_WEBHOOK_URL)return json({error:'Webhook not configured'},503);
 const raw=await request.text();
 if(!(await validSignature(env.SQUARE_WEBHOOK_SIGNATURE_KEY,env.SQUARE_WEBHOOK_URL,raw,request.headers.get('x-square-hmacsha256-signature'))))return json({error:'Invalid signature'},401);
 let event;try{event=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
 if(!['payment.created','payment.updated'].includes(event.type))return json({received:true});
 const payment=event.data?.object?.payment;
 if(!payment?.order_id||payment.status!=='COMPLETED')return json({received:true});
 waitUntil((async()=>{
  const response=await square(env,'GET','/orders/'+encodeURIComponent(payment.order_id));
  const order=response.order;
  const ref=order?.reference_id;
  if(!/^[0-9a-f-]{36}$/i.test(ref||''))return;
  const verified=await verifySquareOrder(env,ref);
  if(verified?.kind==='consultation'&&verified.orderId===payment.order_id)await notifyConsultation(env,ref,verified);
 })().catch(e=>console.error('Square webhook notification failed',e.message)));
 return json({received:true});
}
