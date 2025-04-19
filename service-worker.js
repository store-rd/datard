// محتوى مؤقت لـ service-worker.js (للتحقق من التسجيل فقط)
self.addEventListener('install', event => {
  console.log('[SW Test] Install event');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW Test] Activate event');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  console.log('[SW Test] Fetch event for:', event.request.url);
  // لا تفعل شيئًا، فقط اسمح للطلب بالمرور للشبكة
  event.respondWith(fetch(event.request));
});
