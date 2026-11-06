import { json, PACKAGES, CATEGORIES, createCheckout } from '../../server/square.js';
export async function onRequestPost({request,env}){
 let b;try{b=await request.json()}catch{return json({error:'Invalid request.'},400)}
 const cat=CATEGORIES[b.category],pkg=PACKAGES[b.package],name=String(b.name||'').trim(),email=String(b.email||'').trim(),phone=String(b.phone||'').trim();
 if(!cat||!pkg)return json({error:'Choose a category and package.'},400);
 if(name.length<2||name.length>100)return json({error:'Enter your full name.'},400);
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>200)return json({error:'Enter a valid email.'},400);
 if(!/^[0-9+()\-.\s]{7,25}$/.test(phone))return json({error:'Enter a valid phone.'},400);
 try{return await createCheckout(env,request,{kind:'consultation',category_label:cat,package_label:pkg.label,name,email,phone},
 [{name:cat+' — '+pkg.label+' Consultation',cents:pkg.cents}]);}
 catch(e){console.error('Square consultation checkout',e.message);return json({error:'Could not start Square checkout.'},503);}
}