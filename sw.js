/* ==========================================================================
   令人心动的眼科题目 · 离线缓存 Service Worker
   版本：v1.1-r1   （题库内容更新时，请把 CACHE_NAME 末尾版本号 +1）
   策略：安装即预缓存全部核心文件 → 请求走「缓存优先、后台不覆盖」→ 激活时清旧缓存
   ========================================================================== */

const CACHE_NAME = 'yanke-pwa-v1.1-r1';

/* 预缓存清单：页面本身 + manifest + 三个图标 + 两个 maskable 图标 */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

/* 安装：把核心文件写进缓存，装完立即接管 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

/* 激活：清理本应用的历史缓存版本，并立即接管所有页面 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* 取用：缓存优先；导航请求一律回退到缓存的 index.html，保证断网也能完整打开 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      /* 1) 命中缓存直接返回（离线可用、无需二次加载） */
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      } else {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
      }

      /* 2) 缓存未命中再走网络（并顺手补充进缓存） */
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (err) {
        /* 3) 断网兜底：导航请求返回缓存的页面 */
        if (req.mode === 'navigate') {
          const page = await cache.match('./index.html');
          if (page) return page;
        }
        throw err;
      }
    })()
  );
});
