self.addEventListener("push", (event) => {
  let data = { title: "ORCA FINANCIAL", body: "Bạn có thông báo mới", url: "/dashboard" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `orca-${data.category || "notification"}`,
    data: { url: data.url || "/dashboard" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) { if (client.url.includes(target) && "focus" in client) return client.focus(); }
    return clients.openWindow(target);
  }));
});
