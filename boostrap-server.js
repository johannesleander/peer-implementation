import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'

const clients = new Map()

const server = createServer((req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.url === '/set-peer-with-push') {
    new Response(req).arrayBuffer().then(ab => {
      fs.writeFile('./master.json', new Uint8Array(ab)).then(() => {
        res.statusCode = 204
        res.statusMessage = 'No Content'
        res.end()
      })
    })
  }

  if (req.url === '/get-peer-with-push') {
    res.statusCode = 200
    res.statusMessage = 'OK'
    createReadStream('./master.json').pipe(res)
  }

  // This endpoint is for browsers who yet haven't subscribed to web push
  // peers will start listening to this endpoint and wait for a web push
  // that are coming from `/write-sse`
  if (req.url === '/sse') {
    // Handle server sent events
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive'
    })

    const uuid = crypto.randomUUID()
    clients.set(uuid, res)
    res.write(`data: ${uuid}\n\n`)

    // Listen for close event and remove client from clients map
    req.once('close', () => {
      clients.delete(uuid)
      console.log(`SSE ${uuid} client disconnected`)
    })
  }

  // This will send SDP and ICE candidates to a peer that has a
  // web push -> non web push connection (a.k.a. Server Sent Events connection)
  if (req.url === '/write-sse') {
    new Response(req, { headers: req.headers }).json().then(json => {
      res.statusCode = 204
      res.statusMessage = 'No Content'
      res.end()

      const { caller, ...data } = json
      const client = clients.get(caller)
      if (!client) return
      client.write(`data: ${JSON.stringify(data)}\n\n`)
    })
  }

  // This takes a crafted web push request and forwards it to the push service
  // because the browser doesn't allow CORS for web push requests :(
  // https://github.com/w3c/push-api/issues/303
  if (req.url === '/sendpush') {
    new Response(req, { headers: req.headers }).formData().then(fd => {
      // End the request early, we don't need to wait for the push service.
      // And we don't need to send any data back to the browser.
      res.statusCode = 204
      res.statusMessage = 'No Content'
      res.end()

      // `request` kind of resembles native whatwg Request (apart from headers)
      const request = Object.fromEntries(fd)

      fetch(request.url, {
        method: request.method,
        headers: JSON.parse(request.headers),
        body: request.body
      }).then(res => {
        // console.log('ok', res.ok)
        // console.log('status', res.status)
        // console.log('statusText', res.statusText)
        // console.log('headers', res.headers)
        res.arrayBuffer()
        // .then(console.log)
      })
    })
  }
})

server.listen(3000)
