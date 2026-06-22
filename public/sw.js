// Projekster Service Worker (V1.0)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Standaard netwerk-verzoek. Als het netwerk wegvalt, vangen we het op.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        'Je hebt geen internetverbinding. Verbind met een netwerk om de Projekster kluis te openen.',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    })
  );
});