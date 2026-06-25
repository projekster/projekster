// public/sw.js
// Dit is het achtergrond-proces (Service Worker) dat push notificaties opvangt

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icon.png', // Tip: Zorg dat je ergens een vierkant logo (192x192) in je public map hebt staan als icon.png
      badge: '/icon.png', 
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Wat gebeurt er als de gebruiker op de notificatie tikt?
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Sluit het pop-upje
  
  // Open de app op de juiste URL (bijv. direct naar de chat)
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});