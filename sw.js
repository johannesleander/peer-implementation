const invisiblePngPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4z8ABHgAH9gKxvwAAAABJRU5ErkJggg=='

addEventListener('fetch', evt => {
  if (evt.request.url.endsWith('/chord/clientId')) {
    // return the browsers client id
    evt.respondWith(new Response(evt.clientId))
  }
})

addEventListener('push', async evt => {
  // Read the push message that was sent
  const payload = evt.data.json()
  // Broadcast the message to all tabs
  const bc = new BroadcastChannel('push')
  bc.postMessage(payload)
  bc.close()

  const notificationOptions = {
    body: 'Established a P2P connection',
    icon: invisiblePngPixel,
    badge: invisiblePngPixel,
    tag: 'establish-p2p-connection'
	};

  evt.waitUntil(
    registration.showNotification(
      'Received Payload',
      notificationOptions
    ).catch(console.error)
  )
})

self.addEventListener('notificationclick', evt => {
  evt.notification.close();
});
