const assert = require('node:assert/strict');
const test = require('node:test');

const { createTestApp } = require('../setup/createTestApp');
const invokeApp = require('../setup/invokeApp');

test('GET /health retorna saúde do processo sem consultar o banco', async () => {
  const { app, pool } = createTestApp({ databaseAvailable: false });
  let queryCalled = false;
  pool.query = async () => {
    queryCalled = true;
    throw new Error('não deveria consultar o banco');
  };

  const response = await invokeApp(app, { url: '/health' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(queryCalled, false);
});
