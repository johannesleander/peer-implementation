import './install-sw.js'
import { Chord } from './chord.js'

const chord = new Chord()

$setMaster.onclick = async () => {
  let subscription = await chord.getPushSubscription()
  if (!subscription) subscription = await chord.subScribeToPush()

  await fetch('http://localhost:3000/set-peer-with-push', {
    method: 'POST',
    body: JSON.stringify(subscription)
  }).then(res => res.arrayBuffer())
}

$subscribe.onclick = async () => {
  await chord.getPushSubscription() || await chord.subScribeToPush()
}

$joinDHT.onclick = async () => {
  chord.joinNetworkViaSSE()
}
