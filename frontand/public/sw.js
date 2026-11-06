/* Techline service worker — receives Web Push and opens the panel on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Techline Consultoria", {
      body: data.body || "Você tem uma nova atualização.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/admin" },
      tag: data.tag || "techline",
      renotify: true,
      vibrate: [120, 60, 120],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => "focus" in c);
      if (win) {
        win.navigate(url);
        return win.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Network-only fetch handler: required by some browsers to offer "Install app".
self.addEventListener("fetch", () => {});
