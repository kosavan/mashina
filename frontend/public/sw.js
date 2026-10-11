/* Build replaces PRECACHE and VERSION. Private API/files are never cached here. */
const VERSION='mashina-dev';
const PRECACHE=['/','/index.html','/manifest.webmanifest','/volvo-demo.webp','/porsche-demo.webp','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
event.respondWith(caches.open(VERSION).then(async cache=>{const hit=await cache.match(event.request);if(hit)return hit;try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response}catch(error){if(event.request.mode==='navigate')return (await cache.match('/index.html'))||Response.error();throw error}}))});

/* Deliberately ignore remote text/URLs: no vehicle data on the lock screen. */
self.addEventListener('push',event=>{event.waitUntil(self.registration.showNotification('MASHINA',{body:'Есть напоминание об обслуживании. Откройте свой гараж.',icon:'/icon-192.png',badge:'/icon-192.png',tag:'mashina-reminders'}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const same=clients.find(client=>new URL(client.url).origin===self.location.origin);if(same){await same.focus();await same.navigate('/')}else await self.clients.openWindow(new URL('/',self.location.origin).href)}))});
