import {BOOKS,verifySquareOrder} from '../../server/square.js';
import {readToken} from '../../server/lib.js';
export async function onRequestGet({request,env}){
 const deny=(message,status=403)=>new Response(message,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
 if(!env.DOWNLOAD_SIGNING_SECRET||!env.BOOKS)return deny('Downloads not configured.',503);
 let token;try{token=await readToken(env,new URL(request.url).searchParams.get('t'))}catch{return deny('Could not validate link.',503)}
 if(!token||!BOOKS[token.b])return deny('Invalid or expired link. Reload order page.');
 let order;try{order=await verifySquareOrder(env,token.s)}catch{return deny('Square verification unavailable.',502)}
 if(!order||order.kind!=='books'||!order.items.includes(token.b))return deny('Payment not verified for this book.');
 const key=env[BOOKS[token.b].key];if(!key)return deny('Book not configured.',503);
 const obj=await env.BOOKS.get(key);if(!obj)return deny('Book file unavailable.',404);
 return new Response(obj.body,{headers:{'Content-Type':'application/epub+zip','Content-Disposition':'attachment; filename="'+BOOKS[token.b].file+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}