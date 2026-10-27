/* JF Kids Pull List: opens with no signal (F1) and shows alerts (F2).
   Fast start: the page opens from the copy kept on this phone, and a fresh copy is fetched behind it.
   When the fresh copy is different, the page is told so it can offer "Update". */
const SHELL='pl-shell-v2',KEEP=[SHELL,'pl-data-v1','pl-meta','pl-pdf-v1'];
const FILES=['./index.html','./icon-180.png','./icon-192.png','./icon-512.png','./favicon.png'];
let updateWaiting=false;
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'no-cache'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>!KEEP.includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function tell(){updateWaiting=true;const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});all.forEach(c=>c.postMessage({type:'pl-update'}))}
async function page(e){
  updateWaiting=false;   /* this open gets the newest copy on the phone, so nothing is waiting for it yet */
  const c=await caches.open(SHELL),hit=await c.match('./index.html');
  const oldP=hit?hit.clone().text():Promise.resolve(null);   /* read now: once the copy is handed to the page it can't be read again */
  const fresh=fetch(e.request.url,{cache:'no-cache'}).then(async res=>{
    if(!res||!res.ok)return res;
    const txt=await res.clone().text();
    const old=await oldP;
    await c.put('./index.html',new Response(txt,{headers:{'content-type':'text/html; charset=utf-8'}}));
    if(old!==null&&old!==txt)await tell();
    return res;
  });
  if(hit){e.waitUntil(fresh.catch(()=>{}));return hit}
  return fresh.catch(()=>caches.match('./index.html'));
}
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'||(u.origin===location.origin&&/\/(index\.html)?$/.test(u.pathname))){e.respondWith(page(e));return}
  if(/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/.test(u.hostname)||u.origin===location.origin){
    e.respondWith(caches.open(SHELL).then(async c=>{const hit=await c.match(r);const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>hit);return hit||net}))}
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='pl-ask'&&updateWaiting&&e.source)e.source.postMessage({type:'pl-update'})});
async function meta(k){try{const c=await caches.open('pl-meta'),m=await c.match('/__meta/'+k);return m?await m.text():''}catch(_){return ''}}
async function setMeta(k,v){try{const c=await caches.open('pl-meta');await c.put('/__meta/'+k,new Response(String(v)))}catch(_){}}
/* An alert carries no text; ask the Pull List what it was, then show it. Always show something, or the phone may stop alerts. */
self.addEventListener('push',e=>{e.waitUntil((async()=>{
  let n=null;
  try{const key=await meta('key'),api=await meta('api'),since=Number(await meta('since'))||Date.now()-3*864e5;
    const res=await fetch(api,{method:'POST',body:JSON.stringify({key,op:'notes',a:{since}})}),j=await res.json();
    const list=(j&&j.ok&&j.data)||[];n=list[list.length-1]||null;if(n)await setMeta('since',n.at)}catch(_){}
  return self.registration.showNotification(n?n.title:'Sunday Pull List',{body:n?n.body:'Something changed. Open the Pull List to see it.',icon:'icon-192.png',badge:'icon-192.png',tag:'pl-'+(n?n.at:Date.now()),data:{tab:n&&n.tab||'home'}});
})())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{
  const key=await meta('key'),url=self.registration.scope+'?key='+encodeURIComponent(key)+'#'+(e.notification.data&&e.notification.data.tab||'home');
  const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of all){if(c.url.startsWith(self.registration.scope)){await c.focus();try{c.navigate(url)}catch(_){}return}}
  return self.clients.openWindow(url);
})())});
