const { EventEmitter } = require('node:events');

function invokeApp(app, { method = 'GET', url = '/' } = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { host: 'localhost' };
    req.httpVersion = '1.1';
    req.connection = { encrypted: false };
    req.socket = req.connection;
    req.get = (name) => req.headers[name.toLowerCase()];

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
