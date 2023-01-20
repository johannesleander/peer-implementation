import EncryptionHelperAES128GCM from 'https://jimmy.warting.se/packages/webpush/encryption-aes128gcm.js'
import Peer from './peer.js'

const APPLICATION_KEYS = {
  privateKey: 'hzq_j6QnhJiMGMeaHOj6q7-IkeF21o7zsE9ZvLYLj40',
  publicKey: 'BEVipwO5Kxh5qrBaQBvG6hxiz3iGRzHxyY8W-HlQQ9ch32CWIuiSAQlQ7xG86-D5yF7DyajMVCZ7F6pyYTQ0TtM'
}

const encryptionHelper = new EncryptionHelperAES128GCM({
  vapidKeys: APPLICATION_KEYS,
  // contact information for push service to contact you
  // in case of problem. It's either a mailto: or https: link
  subject: location.origin
})

const textEncoder = new TextEncoder()

export class Chord {

  constructor(root, type) {
    this.#listenForNewPeers()
  }

  async getPushSubscription () {
    if (Notification.permission !== 'granted') {
      await Notification.requestPermission()
    }

    // We are going to need our own subscription also
    // So we can tell our friend who is calling him and reply back
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    return subscription
  }

  async subScribeToPush () {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // a chrome requirement...
      applicationServerKey: APPLICATION_KEYS.publicKey
    })
    return subscription
  }

  async getPeerWithPushSubscription () {
    const res = await fetch('http://localhost:3000/get-peer-with-push')
    return res.json()
  }

  async joinNetworkViaSSE () {
    const subscription = await this.getPeerWithPushSubscription()

    // Our Server Side Event ( B variant of one-way WebSocket )
    // (Other peers will push messages to us via SSE)
    const SSE = new EventSource('http://localhost:3000/sse')

    const uuid = (await new Promise(rs => {
      SSE.addEventListener('message', rs, { once: true })
    })).data

    // I will be the one saying: you go ahead I will rollback on collision
    const peer = new Peer({ polite: true })

    SSE.addEventListener('message', evt => {
      const data = JSON.parse(evt.data)
      peer.signalingPort.postMessage(data)
    }, false)

    peer.signalingPort.onmessage = ({ data }) => {
      this.#sendPushMessage(subscription, { caller: uuid, ...JSON.parse(data) })
    }

    await peer.ready

    console.debug('p2p connection established')
    console.debug('closing SSE - as we are now connected via p2p')
    SSE.close()

    console.debug(peer)

    // TODO: Need to add the peer to the chord DHT network
  }

  /**
   * @params {PushSubsription|object} subscription
   * @params {any} text
   */
  async #sendPushMessage (subscription, object) {
    console.debug('sending push msg')
    const uint8 = textEncoder.encode(JSON.stringify(object))
    const [url, request] = await encryptionHelper.getRequestDetails(
      subscription,
      uint8
    )

    const fd = new FormData()
    fd.set('body', new Blob([request.body]))
    fd.set('headers', JSON.stringify(request.headers))
    fd.set('method', request.method)
    fd.set('url', url)

    fetch('http://localhost:3000/sendpush', { method: 'POST', body: fd })
      .then(res => res.arrayBuffer())
  }

  #listenForNewPeers () {
    const callers = new Map()
    const bc = new BroadcastChannel('push')
    console.debug('listening for new peers', bc)

    bc.onmessage = evt => {
      console.debug('got push msg')
      const { caller, ...data } = evt.data

      if (!callers.has(caller)) {
        const peer = new Peer({ polite: false })
        peer.ready.then(() => {
          callers.delete(caller)
          console.debug('p2p connection established', caller)
          console.debug(peer)
        })

        console.debug('Gathering ICE candidates')

        peer.signalingPort.onmessage = evt => {
          console.debug('ICE gathering complete')
          fetch('http://localhost:3000/write-sse', {
            method: 'POST',
            body: JSON.stringify({
              caller,
              ...JSON.parse(evt.data)
            })
          })
        }

        callers.set(caller, peer)
      }

      callers.get(caller).signalingPort.postMessage(data)
    }
  }
}