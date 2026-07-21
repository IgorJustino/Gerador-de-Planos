const { EventEmitter } = require('node:events');
const { Duplex, Readable } = require('node:stream');

function invokeApp(app, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = body === undefined ? '' : JSON.stringify(body);
    const requestHeaders = {
      host: 'localhost',
      ...Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
      ),
    };

    if (body !== undefined) {
      requestHeaders['content-type'] = 'application/json';
      requestHeaders['content-length'] = Buffer.byteLength(requestBody);
    }

    const req = new Readable({ read() {} });
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = requestHeaders;
    req.httpVersion = '1.1';
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) { callback(); },
    });
    socket.encrypted = false;
    req.connection = socket;
    req.socket = socket;
    req.ip = '127.0.0.1';
    req.get = (name) => req.headers[name.toLowerCase()];
    req.push(requestBody);
    req.push(null);

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.body = '';
    res.locals = {};
    res.headersSent = false;
    res.setHeader = (name, value) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => res.headers[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete res.headers[name.toLowerCase()];
    };
    res.writeHead = (statusCode, headers = {}) => {
      res.statusCode = statusCode;
      Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
      res.headersSent = true;
    };
    res.write = (chunk) => {
      res.body += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
    };
    res.end = (chunk = '') => {
      if (chunk) {
        res.write(chunk);
      }
      res.headersSent = true;
      res.emit('finish');
      let parsedBody = res.body;
      try {
        parsedBody = JSON.parse(res.body);
      } catch (_error) {
        // Respostas não JSON permanecem como texto.
      }
      resolve({ status: res.statusCode, body: parsedBody, headers: res.headers });
    };
    res.req = req;

    app.handle(req, res, reject);
  });
}

module.exports = invokeApp;
