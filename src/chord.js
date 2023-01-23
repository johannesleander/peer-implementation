import EncryptionHelperAES128GCM from '../libs/webpush/encryption-aes128gcm.js'
import { encode } from '../libs/cbor-x/encode.js'
import Peer from '../libs/peer/mod.js'

const APPLICATION_KEYS = {
  privateKey: 'hzq_j6QnhJiMGMeaHOj6q7-IkeF21o7zsE9ZvLYLj40',
  publicKey: 'BEVipwO5Kxh5qrBaQBvG6hxiz3iGRzHxyY8W-HlQQ9ch32CWIuiSAQlQ7xG86-D5yF7DyajMVCZ7F6pyYTQ0TtM'
}

const encryptionHelper = new EncryptionHelperAES128GCM({
  vapidKeys: APPLICATION_KEYS,
  // contact information for push service to contact you
  // in case of problem. It's either a mailto: or https: link
  subject: 'https://example.com/contact',
})

const textEncoder = new TextEncoder()

const uint8 = new Uint8Array(20) // 20 bytes (the max value sha1 can give)
const M = uint8.byteLength * 8 // (160 bits) number of bits used
const ONE = BigInt(1)
const MAX_ID = (BigInt(1) << BigInt(M)) - ONE // 1461501637330902918203684832716283019655932542975n

crypto.getRandomValues(uint8)

export class NodeID {
  constructor (id) {
    this.uint8 = id
    this.bigInt = uint8.reduce((acc, cur, i) => {
      return acc + BigInt(cur) * (ONE << BigInt(i * 8))
    }, BigInt(0))
    this.hex = this.bigInt.toString(16).padStart(40, '0')

    Object.freeze(this)
  }
}

// navigator.connection

export class Chord {

  #callers = new Map()
  #battery = NaN


  constructor(root, type) {
    this.nodeID = new NodeID(crypto.getRandomValues(uint8).slice())
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
    const res = await fetch('/peer-with-push.json')
    return res.json()
  }

  async joinNetworkViaSSE () {
    const subscription = await this.getPeerWithPushSubscription()

    // Our Server Side Event ( B variant of one-way WebSocket )
    // (Other peers will push messages to us via SSE)
    const SSE = new EventSource('/sse')

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

  async joinNetworkViaPushToPush () {
    const localSubscription = await this.getPushSubscription()
    if (!localSubscription) throw new Error('You need to subscribe to push first')
    const remoteSubscription = await this.getPeerWithPushSubscription()
    if (!remoteSubscription) throw new Error('There is no peer with a push subscription')

    const peer = new Peer({ polite: true, trickle: false })
    const id = crypto.randomUUID()
    this.#callers.set(id, peer)

    peer.signalingPort.onmessage = ({ data }) => {
      this.#sendPushMessage(remoteSubscription, {
        push: localSubscription,
        caller: id,
        ...JSON.parse(data)
      })
    }

    await peer.ready

    console.debug('p2p connection established')
    console.debug(peer)
  }

  /**
   * @params {PushSubsription|object} subscription
   * @params {any} text
   */
  async #sendPushMessage (subscription, object) {
    console.debug('sending push msg')
    const uint8 = textEncoder.encode(JSON.stringify(object))
    const req = await encryptionHelper.getRequestDetails(
      subscription,
      uint8
    )
    const fd = new FormData()
    fd.set('body', new Blob([req.body || '']))
    fd.set('headers', JSON.stringify(req.headers))
    fd.set('method', req.method)
    fd.set('url', req.url)

    fetch('/sendpush', { method: 'POST', body: fd })
      .then(res => res.arrayBuffer())
  }

  #listenForNewPeers () {
    const callers = this.#callers
    const bc = new BroadcastChannel('push')
    console.debug('listening for new peers', bc)

    bc.onmessage = evt => {
      console.debug('got push msg')
      const { caller, push, ...data } = evt.data

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
          if (push) {
            this.#sendPushMessage(push, { caller, ...JSON.parse(evt.data) })
          } else {
            fetch('/write-sse', {
              method: 'POST',
              body: JSON.stringify({
                caller,
                ...JSON.parse(evt.data)
              })
            })
          }
        }

        callers.set(caller, peer)
      }

      callers.get(caller).signalingPort.postMessage(data)
    }
  }
}