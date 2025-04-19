// service-worker.js

const CACHE_NAME = 'sales-inventory-v10.3-cache-v1'; // غيّر الرقم عند تحديث الملفات
const urlsToCache = [
  '/', // الصفحة الرئيسية
  'index.html',
  'style.css', // <-- الملف المنفصل المفترض
  'app.js',    // <-- الملف المنفصل المفترض
  'manifest.json',
  // أضف روابط أيقوناتك هنا
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-icon-180.png',
  // أضف رابط Font Awesome CSS إذا لم يكن متغيراً كثيراً
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  // أضف روابط Google Fonts الثابتة
  'https://fonts.googleapis.com/css2?family=Changa:wght@400;700&family=Tajawal:wght@400;700&display=swap',
  // لا تقم بتخزين روابط Firestore SDK هنا بشكل مباشر
];

// حدث التثبيت: تخزين الملفات الأساسية
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting(); // تفعيل الـ SW الجديد فوراً
      })
  );
});

// حدث التفعيل: حذف الكاش القديم
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
         return self.clients.claim(); // التحكم بالصفحات المفتوحة فوراً
     })
  );
});

// حدث الجلب: خدمة الملفات من الكاش أولاً (Cache First)
self.addEventListener('fetch', event => {
  // لا تعترض طلبات Firestore أو Google APIs الأخرى
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('google.com/recaptcha') || // إذا كنت تستخدم reCAPTCHA
      event.request.url.includes('google-analytics') || // إذا كنت تستخدم Analytics
      event.request.method !== 'GET') { // تجاهل POST وغيرها
    return; // دع المتصفح يتعامل معها
  }

  // للملفات الأخرى (HTML, CSS, JS, Fonts, Icons)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد في الكاش، أرجعه
        if (response) {
          // console.log(`[ServiceWorker] Returning from Cache: ${event.request.url}`);
          return response;
        }
        // إذا لم يوجد، اطلبه من الشبكة
        // console.log(`[ServiceWorker] Fetching from Network: ${event.request.url}`);
        return fetch(event.request).then(
          networkResponse => {
            // اختياري: تخزين الاستجابة الجديدة في الكاش للمستقبل
            // يجب التأكد من أن الاستجابة صالحة قبل تخزينها
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                 // لا تخزن الاستجابات غير الصالحة أو من مصادر خارجية بدون CORS
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
            console.error('[ServiceWorker] Fetch failed; returning offline page instead.', error);
            // يمكنك عرض صفحة offline.html مخصصة هنا إذا فشل الجلب من الشبكة والكاش
            // return caches.match('/offline.html');
         });
      })
  );
});