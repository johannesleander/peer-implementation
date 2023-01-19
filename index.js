import Peer from './peer.js'

const peer1 = new Peer({
    polite: false, // the peer that says you go ahead I will rollback on colision
    trickle: false, // default
})

const peer2 = new Peer({
    polite: true, // the peer that says you go ahead I will rollback on colision
    trickle: false, // default
})
globalThis.peer1 = peer1
globalThis.peer2 = peer2

// only used to signal description and candidates to the other peer
// once a connection is establish the DataChannel takes over.
peer1.signalingPort.onmessage = ({ data }) => {
    peer2.signalingPort.postMessage(data)
}

peer2.signalingPort.onmessage = ({ data }) => {
    peer1.signalingPort.postMessage(data)
}

// Wait for both peers to open a connection
await peer1.ready

peer1.dc.onmessage = evt => console.log(evt.data)
peer1.dc.send(JSON.stringify("Hello from peer1"))

peer2.dc.onmessage = evt => console.log(evt.data)
peer2.dc.send(JSON.stringify("Hello from peer2"))
