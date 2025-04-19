// service-worker.js (الكود الأصلي مع التخزين المؤقت)

// !!! هام: غيّر رقم الإصدار في كل مرة تحدث فيها أي من الملفات في urlsToCache !!!
const CACHE_NAME = 'sales-inventory-v10.3-cache-v2'; // <--- تم التغيير إلى v2

// قائمة الملفات الأساسية التي سيتم تخزينها مؤقتًا
// تأكد من أن المسارات صحيحة ومطابقة لمكان ملفاتك
const urlsToCache = [
  './',                     // يمثل المجلد الحالي (datard/) وصفحة index.html إذا كانت في الجذر
  './index.html',
  './manifest.json',
  './style.css',            // ملف CSS الخارجي (تأكد من وجوده ونقل الأنماط إليه لاحقًا)
  // './app.js',             // أضف هذا السطر إذا نقلت الجافاسكربت لملف app.js خارجي

  // --- مسارات الأيقونات (تأكد من صحتها ومن وجود المجلد والملفات) ---
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-icon-180.png',
  // './icons/default-icon.png', // أضف هذا إذا وضعت أيقونة افتراضية محلية

  // --- روابط خارجية (اختياري تخزينها هنا، قد تعتمد على كاش المتصفح) ---
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Changa:wght@400;700&family=Tajawal:wght@400;700&display=swap',
  // روابط Google Fonts الأخرى إذا استخدمت غيرها
];

// --- حدث التثبيت (Install Event) ---
self.addEventListener('install', event => {
  console.log(`[ServiceWorker] Event: Install (${CACHE_NAME})`);
  // انتظر حتى يكتمل التخزين المؤقت للملفات الأساسية
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[ServiceWorker] Caching App Shell: ${urlsToCache.length} files`);
        // addAll تقوم بتحميل وتخزين جميع الملفات. إذا فشل أي ملف، تفشل العملية كلها.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log(`[ServiceWorker] App Shell Cached Successfully (${CACHE_NAME}). Activating immediately.`);
        // يجعل الـ Service Worker الجديد يتحكم بالصفحة فورًا بدلاً من الانتظار لإغلاق جميع علامات التبويب
        return self.skipWaiting();
      })
      .catch(error => {
        // سجل خطأ إذا فشل التخزين المؤقت لأي سبب
        console.error('[ServiceWorker] App Shell Caching Failed:', error);
      })
  );
});

// --- حدث التفعيل (Activate Event) ---
self.addEventListener('activate', event => {
  console.log(`[ServiceWorker] Event: Activate (${CACHE_NAME})`);
  // انتظر حتى يتم تنظيف الكاش القديم
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // إذا كان اسم الكاش لا يطابق الكاش الحالي، قم بحذفه
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing Old Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
       console.log(`[ServiceWorker] Claiming clients for cache ${CACHE_NAME}.`);
       // يجعل الـ Service Worker يتحكم في الصفحات المفتوحة حاليًا فورًا
       return self.clients.claim();
    })
  );
});

// --- حدث الجلب (Fetch Event) ---
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير GET وطلبات Chrome Extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
     return;
  }

  // تجاهل طلبات Firestore API لضمان الحصول على بيانات محدثة دائمًا (Firestore له آلية Offline خاصة به)
  if (event.request.url.includes('firestore.googleapis.com')) {
      return; // دع المتصفح يتعامل معها مباشرة
  }

  // استراتيجية "الكاش أولاً" (Cache First) للملفات الأخرى
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // إذا وجد الملف في الكاش، أرجعه مباشرة
        if (cachedResponse) {
          // console.log(`[ServiceWorker] Returning from Cache: ${event.request.url}`);
          return cachedResponse;
        }

        // إذا لم يوجد الملف في الكاش، اطلبه من الشبكة
        return fetch(event.request).then(
          networkResponse => {
            // --- تخزين الاستجابة الشبكية في الكاش للمستقبل ---
            // تأكد من أن الاستجابة صالحة (status 200) قبل تخزينها
            if(!networkResponse || networkResponse.status !== 200) {
                 // لا تخزن الأخطاء (مثل 404)
                 // console.warn(`[ServiceWorker] Not caching response with status ${networkResponse?.status} for: ${event.request.url}`);
                 return networkResponse;
            }

            // نسخ الاستجابة لأنها stream يمكن قراءتها مرة واحدة فقط
            const responseToCache = networkResponse.clone();

            // فتح الكاش وتخزين الاستجابة الجديدة
            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log(`[ServiceWorker] Caching new resource: ${event.request.url}`);
                cache.put(event.request, responseToCache);
              });

            // إرجاع الاستجابة الأصلية للمتصفح لعرضها
            return networkResponse;
          }
        ).catch(error => {
            // حدث خطأ أثناء طلب الملف من الشبكة (مثل عدم وجود اتصال)
            console.error('[ServiceWorker] Fetch Failed:', error, event.request.url);
            // يمكنك هنا إرجاع صفحة Offline احتياطية إذا أردت
            // return caches.match('./offline.html'); // يجب أن تكون offline.html ضمن urlsToCache
            // أو ببساطة اسمح بظهور خطأ المتصفح الافتراضي
         });
      })
  );
});
