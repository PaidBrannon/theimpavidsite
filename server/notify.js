import {sendEmail,esc} from './lib.js';
export async function notifyConsultation(env,ref,order){
 if(order?.kind!=='consultation'||!env.NOTIFIED||!env.RESEND_API_KEY||!env.NOTIFY_EMAIL_FROM||false)return false;
 const flag='square:consult-notified:'+ref;
 if(await env.NOTIFIED.get(flag))return false;
 const fields=[['Name',order.name],['Email',order.email],['Phone',order.phone],['Category',order.category_label],['Package',order.package_label],['Square order',order.orderId],['Payment','Confirmed by Square']];
 await sendEmail(env,{to:'misterimpavid@gmail.com',subject:'New paid Square consultation',html:'<h2>Paid consultation</h2><table>'+fields.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')+'</table>'});
 await env.NOTIFIED.put('consultation:paid:'+ref,JSON.stringify({...order,reference:ref,paidAt:new Date().toISOString()}),{expirationTtl:7776000});
 await env.NOTIFIED.put(flag,'1',{expirationTtl:7776000});
 return true;
}
