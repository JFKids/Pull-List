/* JF Kids Pull List: opens with no signal (F1) and shows alerts (F2).
   The page itself is always fetched fresh when there's a connection, so an update is never hidden behind an old copy. */
const SHELL='pl-shell-v1',KEEP=[SHELL,'pl-data-v1','pl-meta'];
const FILES=['./','./index.html','./icon-180.png','./icon-192.png','./icon-512.png','./favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>!KEEP.includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(r.mode==='navigate'||(u.origin===location.origin&&/\/(index\.html)?$/.test(u.pathname))){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(SHELL).then(x=>x.put('./index.html',c));return res}).catch(()=>caches.match('./index.html')));return}
  if(/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/.test(u.hostname)||u.origin===location.origin){
    e.respondWith(caches.open(SHELL).then(async c=>{const hit=await c.match(r);const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>hit);return hit||net}))}
});
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
