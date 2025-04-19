// service-worker.js (الكود الأصلي مع التخزين المؤقت)

// !!! هام: غيّر رقم الإصدار في كل مرة تحدث فيها أي من الملفات في urlsToCache !!!
const CACHE_NAME = 'sales-inventory-v10.3-cache-v3'; // <--- تم التغيير إلى v3 (أو أعلى)

const urlsToCache = [
  './',                     // يمثل المجلد الحالي (datard/) وصفحة index.html
  './index.html',
  './manifest.json',
  './style.css',            // تأكد من وجود الملف

  // --- تأكد من صحة مسارات الأيقونات التي أضفتها ---
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-icon-180.png',
  './icons/default-icon.png', // إذا أضفت أيقونة افتراضية محلية بهذا الاسم

  // --- روابط خارجية (اختياري) ---
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Changa:wght@400;700&family=Tajawal:wght@400;700&display=swap',
];

// --- حدث التثبيت (Install Event) ---
self.addEventListener('install', event => {
  console.log(`[ServiceWorker] Event: Install (${CACHE_NAME})`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[ServiceWorker] Caching App Shell: ${urlsToCache.length} files`);
        return cache.addAll(urlsToCache).catch(error => {
             console.error(`[ServiceWorker] Failed to cache one or more URLs during install: `, error);
             throw error;
        });
      })
      .then(() => {
        console.log(`[ServiceWorker] App Shell Cached Successfully (${CACHE_NAME}). Activating immediately.`);
        return self.skipWaiting();
      })
      .catch(err => {
          console.error('[ServiceWorker] Installation failed:', err);
      })
  );
});

// --- حدث التفعيل (Activate Event) ---
self.addEventListener('activate', event => {
  console.log(`[ServiceWorker] Event: Activate (${CACHE_NAME})`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing Old Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
         console.log(`[ServiceWorker] Claiming clients for cache ${CACHE_NAME}.`);
         return self.clients.claim();
     })
     .catch(err => {
          console.error('[ServiceWorker] Activation failed:', err);
     })
  );
});

// --- حدث الجلب (Fetch Event) ---
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
     return;
  }
  if (event.request.url.includes('firestore.googleapis.com')) {
      return;
  }

  // استراتيجية الكاش أولاً
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(
          networkResponse => {
            if(!networkResponse || networkResponse.status !== 200) {
                 return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        ).catch(error => {
            console.error('[ServiceWorker] Fetch Failed (Network request):', error, event.request.url);
            // يمكنك هنا إرجاع صفحة Offline بديلة
         });
      })
  );
});
