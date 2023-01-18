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
    console.log('1', data)
    peer2.signalingPort.postMessage(data)
}

peer2.signalingPort.onmessage = ({ data }) => {
    console.log('2', data)
    peer1.signalingPort.postMessage(data)
}

/**
 * RTCPeerConnection
 */
peer1.pc
peer2.pc

/** 
 * RTCDataChannel - You could use this channel  to send messages but it's
 * recommended that you create your own channel as this gets used for 
 * further negotiation events so it has it own logic
 *   peer.pc.createDataChannel(...)
 */
// peer1.dc.onopen = () => {
//     globalThis.dc = peer1.pc.createDataChannel('foo')
//     dc.send('hej')
// }

// peer2.pc.ondatachannel = evt => {
//     const dc = evt.channel
//     dc.onmessage = evt => console.log(evt.data)
// }

let peer2Channel = ''


const peer1Channel = peer1.pc.createDataChannel('peer1Channel')
peer1Channel.onopen = () => {
    peer1Channel.send('hello from hej peer1')
}
peer1Channel.onmessage = (evt) => console.log(evt.data)

peer2.pc.ondatachannel = (evt) => {
    peer2Channel = evt.channel
    peer2Channel.onmessage = evt => console.log(evt.data)
    peer2Channel.send('hello from hej peer2')
}
