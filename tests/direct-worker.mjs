// Isolated test harness; never part of the production Worker.
import {directPage,htmlPage} from '../website/direct-research.mjs';
export default {async fetch(request){
 const input=await request.json(),calls=[];
 try{
  const fetcher=async(url,options)=>{calls.push({url,headers:options.headers,redirect:options.redirect});const entry=input.responses[url];if(!entry)throw Error('Unmocked request');return new Response(entry.body,{status:entry.status||200,headers:entry.headers||{'Content-Type':'text/html'}})};
  const result=input.html?await htmlPage(input.html,input.url):await directPage(input.url,'acmehousing.com',{fetcher});
  return Response.json({result,calls});
 }catch(error){return Response.json({error:error.message,calls})}
}};
