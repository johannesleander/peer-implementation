// checks if service worker isn't already registered and if not, registers it
// and reloads the page. Otherwise, it does nothing.

// Check if service worker is already registered
const registration = await navigator.serviceWorker.getRegistrations()

if (!registration.length) {
  // Register service worker
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  location.reload()
} else {
  // send postMessage to service worker
  navigator.serviceWorker.controller?.postMessage('hello')
}

// Dummy export to get VSCode to understand top-level await
export { }