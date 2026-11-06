const BOOK_IDS=new Set(['rg','wws','mom']);
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function authorized(request,env){
 const expected=env.REVIEW_ADMIN_SECRET;
 const supplied=request.headers.get('Authorization')||'';
 if(!expected||expected.length<24||!supplied.startsWith('Bearer '))return false;
 const token=supplied.slice(7);
 if(token.length!==expected.length)return false;
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
export async function onRequestGet({request,env}){
 if(!authorized(request,env))return reply({error:'Unauthorized.'},401);
 if(!env.NOTIFIED)return reply({error:'Review storage unavailable.'},503);
 const listing=await env.NOTIFIED.list({prefix:'review:pending:',limit:100});
 const reviews=(await Promise.all(listing.keys.map(k=>env.NOTIFIED.get(k.name,'json')))).filter(Boolean).sort((a,b)=>a.createdAt-b.createdAt);
 return reply({reviews});
}
export async function onRequestPost({request,env}){
 if(!authorized(request,env))return reply({error:'Unauthorized.'},401);
 if(!env.NOTIFIED)return reply({error:'Review storage unavailable.'},503);
 let body;try{body=await request.json()}catch{return reply({error:'Invalid request.'},400)}
 if(!['approve','reject'].includes(body.action)||!/^[0-9a-f-]{36}$/i.test(body.id||''))return reply({error:'Invalid action.'},400);
 const key='review:pending:'+body.id;
 const review=await env.NOTIFIED.get(key,'json');
 if(!review)return reply({error:'Review not found or already processed.'},404);
 if(!BOOK_IDS.has(review.book))return reply({error:'Invalid book.'},422);
 if(body.action==='approve')await env.NOTIFIED.put('review:approved:'+review.book+':'+review.id,JSON.stringify(review));
 await env.NOTIFIED.delete(key);
 return reply({ok:true,action:body.action});
}
