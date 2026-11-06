import {sendEmail,esc} from './lib.js';
export async function notifyConsultation(env,ref,order){
 if(order?.kind!=='consultation'||!env.NOTIFIED||!env.RESEND_API_KEY||!env.NOTIFY_EMAIL_FROM||!env.NOTIFY_EMAIL_TO)return false;
 const flag='square:consult-notified:'+ref;
 if(await env.NOTIFIED.get(flag))return false;
 const fields=[['Name',order.name],['Email',order.email],['Phone',order.phone],['Category',order.category_label],['Package',order.package_label],['Square order',order.orderId]];
 await sendEmail(env,{to:env.NOTIFY_EMAIL_TO,subject:'New paid Square consultation',html:'<h2>Paid consultation</h2><table>'+fields.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')+'</table>'});
 await env.NOTIFIED.put(flag,'1',{expirationTtl:7776000});
 return true;
}
