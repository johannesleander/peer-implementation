import { createServer } from 'node:http'
import { createReadStream, createWriteStream } from 'node:fs'
import { platform } from 'node:process'
import { exec } from 'node:child_process'

const clients = new Map()
const directory = new URL('./', import.meta.url).pathname.slice(0, -1)

const tinyRouter = {
  '/favicon.ico' (req, res) {
    res.writeHead(404, 'Not Found', {})
    res.end()
  },

  '/' (req, res) {
    // serve index.html
    res.writeHead(200, 'OK', {
      'content-type': 'text/html',
      'cache-control': 'no-cache'
    })
    createReadStream(directory + '/index.html').pipe(res)
  },

  '/set-peer-with-push' (req, res) {
    req.pipe(createWriteStream(directory + '/peer-with-push.json'))
      .on('finish', () => {
        res.writeHead(204, 'No Content', {})
        res.end()
      })
  },

  // This endpoint is for browsers who yet haven't subscribed to web push
  // peers will start listening to this endpoint and wait for a web push
  // that are coming from `/write-sse`
  '/sse' (req, res) {
    // Handle server sent events
    res.writeHead(200, 'OK', {
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
  },

  // This will send SDP and ICE candidates to a peer that has a
  // web push -> non web push connection (a.k.a. Server Sent Events connection)
  '/write-sse' (req, res) {
    new Response(req, { headers: req.headers }).json().then(json => {
      res.writeHead(204, 'No Content', {})
      res.end()

      const { caller, ...data } = json
      const client = clients.get(caller)
      if (!client) return
      client.write(`data: ${JSON.stringify(data)}\n\n`)
    })
  },

  // This takes a crafted web push request and forwards it to the push service
  // because the browser doesn't allow CORS for web push requests :(
  // https://github.com/w3c/push-api/issues/303
  '/sendpush' (req, res) {
    new Response(req, { headers: req.headers }).formData().then(fd => {
      // End the request early, we don't need to wait for the push service.
      // And we don't need to send any data back to the browser.
      res.writeHead(204, 'No Content', {})

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
}

const contentTypes = {
  'html': 'text/html',
  'js': 'text/javascript',
  'css': 'text/css'
}

const server = createServer((req, res) => {
  let { pathname } = new URL(req.url, `http://${req.headers.host}`)
  if (pathname === '/') pathname = '/index.html'

  if (pathname in tinyRouter) {
    tinyRouter[req.url](req, res)
  } else {
    const file = directory + pathname

    try {
      const rs = createReadStream(file)
      // figure out the content type
      const ext = file.split('.').pop()
      const contentType = contentTypes[ext] || 'text/plain'
      res.writeHead(200, 'OK', {
        'content-type': contentType,
        'cache-control': 'no-cache'
      })
      rs.pipe(res)
    } catch (err) {
      res.writeHead(404, 'Not Found', {})
      res.end(`404 Not Found: ${file}`)
    }
  }
})

server.listen(3011)
console.log('Server listening on port 3011')

// open up the browser
const isWin = platform === 'win32'
const cmd = isWin ? 'start' : 'open'
exec(`${cmd} http://localhost:3011`)