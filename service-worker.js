// service-worker.js (الكود الأصلي مع التخزين المؤقت)

// !!! هام: غيّر رقم الإصدار في كل مرة تحدث فيها أي من الملفات في urlsToCache !!!
const CACHE_NAME = 'sales-inventory-v10.5-cache-v12'; // <--- تم التغيير إلى v5

const urlsToCache = [
  './',                     // الجذر النسبي
  './index.html',           //
  './manifest.json',        //
  './style.css',            // تأكد من وجود الملف

  // --- تأكد من صحة مسارات الأيقونات التي أضفتها ---
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-icon-180.png',
  './icons/default-icon.png', // تأكد من وجود هذه الأيقونة إذا أضفتها

  // --- روابط خارجية (اختياري تخزينها) ---
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
        // استخدام addAll يتوقف إذا فشل تحميل أي ملف
        return cache.addAll(urlsToCache).catch(error => {
             console.error(`[ServiceWorker] Failed to cache one or more URLs during install: `, error);
             // Check which URL failed - very important for debugging cache issues!
             console.error("Failed URL(s) might be among:", urlsToCache);
             throw error; // Stop installation if essential files fail
        });
      })
      .then(() => {
        console.log(`[ServiceWorker] App Shell Cached Successfully (${CACHE_NAME}). Activating immediately.`);
        return self.skipWaiting(); // Activate the new SW immediately
      })
      .catch(err => {
          console.error('[ServiceWorker] Installation failed:', err);
      })
  );
});

// --- حدث التفعيل (Activate Event) ---
self.addEventListener('activate', event => {
  console.log(`[ServiceWorker] Event: Activate (${CACHE_NAME})`);
  // Clean up old caches
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
         return self.clients.claim(); // Take control of open pages
     })
     .catch(err => {
          console.error('[ServiceWorker] Activation failed:', err);
     })
  );
});

// --- حدث الجلب (Fetch Event) ---
self.addEventListener('fetch', event => {
  // Ignore non-GET requests and Chrome extensions
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
     return;
  }
  // Ignore Firestore API calls (Firestore handles its own offline)
  if (event.request.url.includes('firestore.googleapis.com')) {
      return;
  }

  // Cache-First Strategy for other requests
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          // console.log(`[ServiceWorker] Returning from Cache: ${event.request.url}`);
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if(!networkResponse || networkResponse.status !== 200) {
                 // console.warn(`[ServiceWorker] Not caching non-200 response for: ${event.request.url}`);
                 return networkResponse; // Don't cache errors or redirects
            }

            // Clone the response stream
            const responseToCache = networkResponse.clone();

            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log(`[ServiceWorker] Caching new resource: ${event.request.url}`);
                cache.put(event.request, responseToCache);
              });

            // Return the original response to the browser
            return networkResponse;
          }
        ).catch(error => {
            // Network request failed (likely offline)
            console.error('[ServiceWorker] Fetch Failed (Network request):', error, event.request.url);
            // Optional: Return a fallback offline page
            // return caches.match('./offline.html');
         });
      })
  );
});
