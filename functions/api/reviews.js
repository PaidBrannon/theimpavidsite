import {json} from '../../server/lib.js';
const BOOK_IDS=new Set(['rg','wws','mom']);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
export async function onRequestGet({request,env}){
 const book=new URL(request.url).searchParams.get('book');
 if(!BOOK_IDS.has(book))return reply({error:'Unknown book.'},400);
 if(!env.NOTIFIED)return reply({error:'Reviews temporarily unavailable.'},503);
 const listing=await env.NOTIFIED.list({prefix:'review:approved:'+book+':',limit:100});
 const reviews=(await Promise.all(listing.keys.map(k=>env.NOTIFIED.get(k.name,'json')))).filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30).map(({id,name,rating,text,createdAt})=>({id,name,rating,text,createdAt}));
 return reply({reviews});
}
export async function onRequestPost({request,env}){
 if(!env.NOTIFIED)return reply({error:'Reviews temporarily unavailable.'},503);
 if(Number(request.headers.get('content-length')||0)>8192)return reply({error:'Review too large.'},413);
 let data;try{data=await request.json()}catch{return reply({error:'Invalid review.'},400)}
 const book=String(data.book||''),name=String(data.name||'').trim(),text=String(data.text||'').trim(),rating=Number(data.rating);
 if(data.website)return reply({submitted:true});
 if(!BOOK_IDS.has(book)||name.length<2||name.length>60||text.length<15||text.length>1200||!Number.isInteger(rating)||rating<1||rating>5)return reply({error:'Enter a name (2–60 characters), 1–5 stars, and a review (15–1200 characters).'},400);
 const id=crypto.randomUUID(),review={id,book,name,rating,text,createdAt:Date.now()};
 await env.NOTIFIED.put('review:pending:'+id,JSON.stringify(review),{expirationTtl:60*60*24*180});
 return reply({submitted:true,message:'Thank you. Your review will appear after approval.'},202);
}
