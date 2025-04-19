// service-worker.js (الكود الأصلي مع التخزين المؤقت)

// !!! هام: غيّر رقم الإصدار في كل مرة تحدث فيها الملفات المخزنة !!!
const CACHE_NAME = 'sales-inventory-v10.3-cache-v2'; // <--- غيرنا إلى v2 (أو أي رقم جديد)

const urlsToCache = [
  './', // يمثل الجذر النسبي للمجلد الحالي (datard/)
  './index.html',
  './style.css', // تأكد من استخدام هذا الملف بدلاً من الـ inline style لاحقًا
  // './app.js',    // أضف هذا إذا نقلت الجافاسكربت لملف خارجي
  './manifest.json',
  // تأكد من صحة المسارات والأسماء بناءً على مجلد icons لديك
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-icon-180.png',
  './icons/default-icon.png', // إذا أضفت أيقونة افتراضية محلية
  // روابط خارجية (ستعتمد على الكاش الخاص بالمتصفح لها، قد لا تحتاج لتخزينها هنا مباشرة)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Changa:wght@400;700&family=Tajawal:wght@400;700&display=swap',
];

// حدث التثبيت: تخزين الملفات الأساسية
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install Event - Caching App Shell');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Opened cache:', CACHE_NAME);
        // استخدام addAll يتوقف إذا فشل تحميل أي ملف
        return cache.addAll(urlsToCache).catch(error => {
             console.error('[ServiceWorker] Failed to cache urls:', urlsToCache, error);
             // قد تحتاج لمعالجة هذا الخطأ بشكل أفضل
        });
      })
      .then(() => {
        console.log('[ServiceWorker] App Shell Cached Successfully. Activating immediately.');
        return self.skipWaiting(); // تفعيل الـ SW الجديد فوراً
      })
      .catch(err => {
          console.error('[ServiceWorker] Installation failed:', err);
      })
  );
});

// حدث التفعيل: حذف الكاش القديم
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate Event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
         console.log('[ServiceWorker] Claiming clients.');
         return self.clients.claim(); // التحكم بالصفحات المفتوحة فوراً
     })
     .catch(err => {
          console.error('[ServiceWorker] Activation failed:', err);
     })
  );
});

// حدث الجلب: خدمة الملفات من الكاش أولاً (Cache First)
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير GET وطلبات Chrome Extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
     // console.log('[ServiceWorker] Ignoring non-GET/extension request:', event.request.url);
     return;
  }

  // تجاهل طلبات Firestore API
  if (event.request.url.includes('firestore.googleapis.com')) {
      // console.log('[ServiceWorker] Ignoring Firestore request:', event.request.url);
      return; // دع المتصفح يتعامل معها مباشرة
  }

  // للملفات الأخرى (HTML, CSS, JS, Fonts, Icons)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // إذا وجد في الكاش، أرجعه
        if (cachedResponse) {
          // console.log(`[ServiceWorker] Returning from Cache: ${event.request.url}`);
          return cachedResponse;
        }

        // إذا لم يوجد، اطلبه من الشبكة
        // console.log(`[ServiceWorker] Fetching from Network: ${event.request.url}`);
        return fetch(event.request).then(
          networkResponse => {
            // --- تحسين: فقط خزن الاستجابات الناجحة والأساسية ---
            if(!networkResponse || networkResponse.status !== 200 /* || networkResponse.type !== 'basic' */) {
                 // لا تخزن الاستجابات غير الصالحة (قد نحتاج لتخزين basic و cors للخطوط/CDN)
                 // console.log(`[ServiceWorker] Not caching non-200 response: ${event.request.url} Status: ${networkResponse?.status}`);
                 return networkResponse;
            }

            // نسخ الاستجابة لأنها stream يمكن قراءتها مرة واحدة
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log(`[ServiceWorker] Caching new resource: ${event.request.url}`);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            // حدث خطأ في جلب الملف من الشبكة (قد يكون الجهاز غير متصل)
            console.error('[ServiceWorker] Fetch failed; network error or offline:', error);
            // هنا يمكنك اختيار عرض صفحة "أنت غير متصل" مخصصة إذا أردت
            // return caches.match('./offline.html'); // ستحتاج لإنشاء وتخزين offline.html
            // أو فقط اسمح للفشل بالحدوث ليظهر خطأ المتصفح الافتراضي
            // throw error; // أو أعد إلقاء الخطأ
         });
      })
  );
});
