const uint8 = new Uint8Array(20) // 20 bytes (the max value sha1 can give)
const M = uint8.byteLength * 8 // (160 bits) number of bits used
const ONE = BigInt(1)
const MAX_ID = (BigInt(1) << BigInt(M)) - ONE // 1461501637330902918203684832716283019655932542975n

crypto.getRandomValues(uint8)

export class Node {
  constructor () {

  }
}