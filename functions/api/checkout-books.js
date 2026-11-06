import { json, BOOKS, createCheckout } from '../../server/square.js';
export async function onRequestPost({ request, env }) {
 let b; try { b=await request.json(); } catch { return json({error:'Invalid request.'},400); }
 const keys=[...new Set(Array.isArray(b.items)?b.items:[])];
 if(!keys.length||keys.some(k=>!BOOKS[k]))return json({error:'Choose available books.'},400);
 if(keys.some(k=>!env.BOOKS||!env[BOOKS[k].key]))return json({error:'This ebook is not available for purchase yet.'},409);
 try {for(const k of keys){if(!(await env.BOOKS.head(env[BOOKS[k].key])))return json({error:'This ebook is not available for purchase yet.'},409)}}catch(e){console.error('Ebook availability check failed',e.message);return json({error:'Ebook availability could not be verified. Please try again later.'},503)}
 try {return await createCheckout(env,request,{kind:'books',items:keys},keys.map(k=>({name:BOOKS[k].title,cents:BOOKS[k].cents}))); }
 catch(e){console.error('Square book checkout',e.message);return json({error:'Could not start Square checkout.'},503);}
}