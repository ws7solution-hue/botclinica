// ── BotClínica — Service Worker (notificações push) ──────────────────────────
// Roda em segundo plano no navegador, mesmo com a aba minimizada. É isso
// que permite a notificação aparecer como um alerta de verdade do sistema
// operacional, parecido com um app instalado.

self.addEventListener('push', (event) => {
  let data = { title: 'BotClínica', body: 'Você tem uma notificação nova.', url: 'https://botclinica.com.br/crm' };
  try {
    data = event.data.json();
  } catch (e) {
    // se não vier em JSON, usa o texto puro como corpo da notificação
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BotClínica', {
      body: data.body || '',
      icon: '/logo-icon.png',
      badge: '/logo-icon.png',
      data: { url: data.url || 'https://botclinica.com.br/crm' },
    })
  );
});

// Ao clicar na notificação, abre (ou foca) a aba do CRM
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || 'https://botclinica.com.br/crm';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('botclinica.com.br') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
