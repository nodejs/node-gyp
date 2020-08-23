const url = require('url')
const http = require('http')
const https = require('https')
const stream = require('stream')
const caseless = require('caseless')
const tunnel = require('tunnel-agent')

const isUrl = /^https?:/
const globalPool = {}

function filterForNonReserved (reserved, options) {
  // Filter out properties that are not reserved.
  // Reserved values are passed in at call site.

  const object = {}
  for (const i in options) {
    if (reserved.indexOf(i) === -1) {
      object[i] = options[i]
    }
  }
  return object
}

class Request extends stream.Stream {
  constructor (options) {
    super()
    const reserved = Object.keys(Request.prototype)
    const nonReserved = filterForNonReserved(reserved, options)

    Object.assign(this, nonReserved)

    this.readable = true
    this.writable = true

    this._redirect = new Redirect(this)
    this._tunnel = new Tunnel(this)
    this.init()
  }

  init (options) {
    caseless.httpify(this, this.headers)

    this.method = 'GET'

    this.pool = globalPool

    // If a string URI/URL was given, parse it into a URL object
    if (typeof this.uri === 'string') {
      this.uri = new url.URL(this.uri)
    }

    if (!this.uri.pathname) { this.uri.pathname = '/' }

    this.tunnel = this._tunnel.isEnabled()
    if (this.proxy) {
      this._tunnel.setup(options)
    }

    if (this.proxy && !this.tunnel) {
      this.port = this.proxy.port
      this.host = this.proxy.hostname
    } else {
      this.port = this.uri.port
      this.host = this.uri.hostname
    }

    if (this.uri.path) {
      this.path = this.uri.path
    } else {
      this.path = this.uri.pathname + (this.uri.search || '')
    }

    const protocol = this.proxy && !this.tunnel ? this.proxy.protocol : this.uri.protocol
    const httpModules = { 'http:': http, 'https:': https }

    this.httpModule = httpModules[protocol]

    if (!this.httpModule) {
      return this.emit('error', new Error('Invalid protocol: ' + protocol))
    }

    if (!this.agent) {
      this.agentClass = this.httpModule.Agent
    }

    this.agent = this.agent || this.getNewAgent()

    setImmediate(() => {
      this.end()

      this.ntick = true
    })
  }

  getNewAgent () {
    const Agent = this.agentClass
    const options = {}
    if (this.ca) {
      options.ca = this.ca
    }

    let poolKey = ''

    // different types of agents are in different pools
    if (Agent !== this.httpModule.Agent) {
      poolKey += Agent.name
    }

    // ca option is only relevant if proxy or destination are https
    let proxy = this.proxy
    if (typeof proxy === 'string') {
      proxy = new url.URL(proxy)
    }
    Object.assign(options, proxy)
    const isHttps = (proxy && proxy.protocol === 'https:') || this.uri.protocol === 'https:'

    if (isHttps) {
      if (options.ca) {
        if (poolKey) {
          poolKey += ':'
        }
        poolKey += options.ca
      }
    }

    if (this.pool === globalPool && !poolKey && Object.keys(options).length === 0 && this.httpModule.globalAgent) {
      // not doing anything special.  Use the globalAgent
      return this.httpModule.globalAgent
    }

    // we're using a stored agent.  Make sure it's protocol-specific
    poolKey = this.uri.protocol + poolKey

    // generate a new agent for this setting if none yet exists
    if (!this.pool[poolKey]) {
      this.pool[poolKey] = new Agent(options)
    }

    return this.pool[poolKey]
  }

  start () {
    this._started = true
    this.href = this.uri.href

    try {
      this.req = this.httpModule.request(this)
    } catch (err) {
      this.emit('error', err)
      return
    }

    this.req.on('response', this.onRequestResponse.bind(this))
    this.req.on('error', this.onRequestError.bind(this))
    this.req.on('drain', () => { this.emit('drain') })
    this.req.on('socket', (socket) => { this.emit('socket', socket) })
  }

  onRequestError (error) {
    this.emit('error', error)
  }

  onRequestResponse (response) {
    this.response = response
    response.request = this

    response.caseless = caseless(response.headers)

    if (this._redirect.onResponse(response)) {
      return // Ignore the rest of the response
    }

    // Be a good stream and emit end when the response is finished.
    // Hack to emit end on close because of a core bug that never fires end
    response.on('close', () => {
      if (!this._ended) {
        this.response.emit('end')
      }
    })

    response.once('end', () => {
      this._ended = true
    })

    this.emit('response', response)

    response.on('data', (chunk) => {
      this._destdata = true
      this.emit('data', chunk)
    })
    response.once('end', (chunk) => { this.emit('end', chunk) })
    response.on('error', (error) => { this.emit('error', error) })
    response.on('close', () => { this.emit('close') })

    this.on('end', () => { this.emit('complete', response) })
  }

  // Stream API
  pipe (dest) {
    if (this.response) {
      if (this._destdata) {
        this.emit('error', new Error('You cannot pipe after data has been emitted from the response.'))
      } else if (this._ended) {
        this.emit('error', new Error('You cannot pipe after the response has been ended.'))
      } else {
        stream.Stream.prototype.pipe.call(this, dest)
        return dest
      }
    } else {
      stream.Stream.prototype.pipe.call(this, dest)
      return dest
    }
  }

  end () {
    if (!this._started) {
      this.start()
    }
    if (this.req) {
      this.req.end()
    }
  }

  destroy () {
    if (!this._ended) {
      this.end()
    } else if (this.response) {
      this.response.destroy()
    }
  }
}

class Redirect {
  constructor (request) {
    this.request = request
    this.redirects = []
    this.redirectsFollowed = 0
    this.maxRedirects = 10
  }

  redirectTo (response) {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.caseless.has('location')) {
      return response.caseless.get('location')
    }

    return null
  }

  onResponse (response) {
    const request = this.request

    let redirectTo = this.redirectTo(response)
    if (!redirectTo) {
      return false
    }

    // ignore any potential response body.  it cannot possibly be useful
    // to us at this point.
    response.resume()

    if (this.redirectsFollowed >= this.maxRedirects) {
      request.emit('error', new Error('Exceeded maxRedirects. Probably stuck in a redirect loop ' + request.uri.href))
      return false
    }
    this.redirectsFollowed += 1

    if (!isUrl.test(redirectTo)) {
      redirectTo = new url.URL(redirectTo, request.uri.href)
    }

    const uriPrev = request.uri
    request.uri = new url.URL(redirectTo)

    // handle the case where we change protocol from https to http or vice versa
    if (request.uri.protocol !== uriPrev.protocol) {
      delete request.agent
    }

    this.redirects.push({ statusCode: response.statusCode, redirectUri: redirectTo })

    delete request.req
    delete request._started

    request.setHeader('referer', uriPrev.href)

    request.emit('redirect')

    request.init()

    return true
  }
}

const defaultProxyHeaderWhiteList = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'accept-ranges',
  'cache-control',
  'content-encoding',
  'content-language',
  'content-location',
  'content-md5',
  'content-range',
  'content-type',
  'connection',
  'date',
  'expect',
  'max-forwards',
  'pragma',
  'referer',
  'te',
  'user-agent',
  'via'
]

const defaultProxyHeaderExclusiveList = [
  'proxy-authorization'
]

class Tunnel {
  constructor (request) {
    this.request = request
    this.proxyHeaderWhiteList = defaultProxyHeaderWhiteList
    this.proxyHeaderExclusiveList = []
    if (typeof request.tunnel !== 'undefined') {
      this.tunnelOverride = request.tunnel
    }
  }

  isEnabled () {
    const request = this.request

    // If self.tunnelOverride is set (the user specified a value), use it.
    if (typeof this.tunnelOverride !== 'undefined') {
      return this.tunnelOverride
    }

    // If the destination is HTTPS, tunnel.
    if (request.uri.protocol === 'https:') {
      return true
    }

    // Otherwise, do not use tunnel.
    return false
  }

  setup (options) {
    const request = this.request

    options = options || {}

    if (typeof request.proxy === 'string') {
      request.proxy = new url.URL(request.proxy)
    }

    if (!request.proxy || !request.tunnel) {
      return false
    }

    const proxyHeaderExclusiveList = this.proxyHeaderExclusiveList.concat(defaultProxyHeaderExclusiveList)
    const proxyHeaderWhiteList = this.proxyHeaderWhiteList.concat(proxyHeaderExclusiveList)

    // Setup Proxy Headers and Proxy Headers Host
    // Only send the Proxy White Listed Header names
    const proxyHeaders = Tunnel.constructProxyHeaderWhiteList(request.headers, proxyHeaderWhiteList)
    proxyHeaders.host = Tunnel.constructProxyHost(request.uri)

    proxyHeaderExclusiveList.forEach(request.removeHeader, request)

    // Set Agent from Tunnel Data
    const tunnelFn = Tunnel.getTunnelFn(request)
    const tunnelOptions = Tunnel.constructTunnelOptions(request, proxyHeaders)
    request.agent = tunnelFn(tunnelOptions)

    return true
  }

  static constructProxyHeaderWhiteList (headers, proxyHeaderWhiteList) {
    const whiteList = new Set(proxyHeaderWhiteList)

    return Object.keys(headers)
      .filter(header => whiteList.has(header.toLowerCase()))
      .reduce((set, header) => {
        set[header] = headers[header]
        return set
      }, {})
  }

  static constructProxyHost (uriObject) {
    const port = uriObject.port
    const protocol = uriObject.protocol
    let proxyHost = uriObject.hostname + ':'

    if (port) {
      proxyHost += port
    } else if (protocol === 'https:') {
      proxyHost += '443'
    } else {
      proxyHost += '80'
    }

    return proxyHost
  }

  static constructTunnelOptions (request, proxyHeaders) {
    const proxy = request.proxy

    const tunnelOptions = {
      proxy: {
        host: proxy.hostname,
        port: +proxy.port,
        proxyAuth: proxy.auth,
        headers: proxyHeaders
      },
      headers: request.headers,
      ca: request.ca
    }

    return tunnelOptions
  }

  static constructTunnelFnName (uri, proxy) {
    const uriProtocol = (uri.protocol === 'https:' ? 'https' : 'http')
    const proxyProtocol = (proxy.protocol === 'https:' ? 'Https' : 'Http')
    return [uriProtocol, proxyProtocol].join('Over')
  }

  static getTunnelFn (request) {
    const uri = request.uri
    const proxy = request.proxy
    const tunnelFnName = Tunnel.constructTunnelFnName(uri, proxy)
    return tunnel[tunnelFnName]
  }
}

module.exports = Request

module.exports.test = {
  Redirect,
  Tunnel
}
