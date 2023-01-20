
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
})

addEventListener('message', evt => {
  evt.waitUntil(new Promise(rs => {
    // nah, i'm good
  }))
})
