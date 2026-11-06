import {json} from '../../server/lib.js';
export async function onRequestGet({request,env}){
 const secret=request.headers.get('X-Admin-Secret');
 if(!env.REVIEW_ADMIN_SECRET||!secret||secret!==env.REVIEW_ADMIN_SECRET)return json({error:'Unauthorized'},401);
 if(!env.NOTIFIED)return json({error:'Booking storage is not configured.'},503);
 let cursor,items=[];
 do{
  const page=await env.NOTIFIED.list({prefix:'consultation:paid:',limit:100,...(cursor?{cursor}:{})});
  for(const key of page.keys){
   const value=await env.NOTIFIED.get(key.name);
   if(value){try{const b=JSON.parse(value);items.push({reference:b.reference,name:b.name,email:b.email,phone:b.phone,category:b.category_label,package:b.package_label,amount:b.amount,paidAt:b.paidAt,status:'Paid — scheduling pending'})}catch{}}
  }
  cursor=page.list_complete?null:page.cursor;
 }while(cursor&&items.length<500);
 items.sort((a,b)=>String(b.paidAt).localeCompare(String(a.paidAt)));
 return json({bookings:items,total:items.length,revenueCents:items.reduce((sum,b)=>sum+(Number(b.amount)||0),0)});
}
