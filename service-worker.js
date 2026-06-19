/*
 * Service Worker работает отдельно от страницы.
 * Его задача — сохранить основные файлы приложения в кеше,
 * чтобы интерфейс мог открываться даже без интернета.
 */

// При любом важном изменении списка файлов увеличиваем номер версии кеша.
// Новое имя заставит браузер создать свежий кеш и удалить старый.
const CACHE_NAME = "pwa-scheduler-v3-commented";

// Это «оболочка приложения»: минимальный набор файлов для офлайн-запуска.
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

/* -------------------------------------------------------------------------- */
/* Установка Service Worker                                                   */
/* -------------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  // waitUntil сообщает браузеру, что установка не закончена,
  // пока все перечисленные файлы не будут добавлены в кеш.
  event.waitUntil(
    caches
      // Открываем кеш с текущим именем или создаём его.
      .open(CACHE_NAME)

      // Загружаем и сохраняем все файлы оболочки приложения.
      .then((cache) => cache.addAll(APP_SHELL))

      // Просим новый Service Worker не ждать закрытия старых вкладок.
      .then(() => self.skipWaiting())
  );
});

/* -------------------------------------------------------------------------- */
/* Активация и очистка старых кешей                                           */
/* -------------------------------------------------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      // Получаем названия всех кешей этого сайта.
      .keys()

      // Удаляем каждый кеш, имя которого не совпадает с текущей версией.
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))

      // Новый Service Worker сразу начинает управлять уже открытыми страницами.
      .then(() => self.clients.claim())
  );
});

/* -------------------------------------------------------------------------- */
/* Перехват сетевых запросов                                                  */
/* -------------------------------------------------------------------------- */

self.addEventListener("fetch", (event) => {
  // Не кешируем POST, PUT, DELETE и другие изменяющие запросы.
  if (event.request.method !== "GET") return;

  // Навигационный запрос означает открытие HTML-страницы.
  if (event.request.mode === "navigate") {
    event.respondWith(
      // Сначала пробуем получить свежую страницу из сети.
      fetch(event.request)
        .then((response) => {
          // Ответ можно прочитать только один раз, поэтому создаём копию для кеша.
          const copy = response.clone();

          // Обновляем сохранённую главную страницу в фоне.
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));

          // Пользователю возвращаем свежий сетевой ответ.
          return response;
        })

        // Если сети нет, открываем ранее сохранённый index.html.
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  // Для CSS, JavaScript, manifest и иконок сначала проверяем кеш.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если файл уже есть в кеше, возвращаем его сразу.
      if (cachedResponse) return cachedResponse;

      // Если файла нет, загружаем его из сети.
      return fetch(event.request).then((response) => {
        // Не сохраняем ошибочные и непрозрачные ответы.
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        // Клонируем ответ: одну копию сохраняем, другую отдаём странице.
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));

        return response;
      });
    })
  );
});
