const assert = require('node:assert/strict');
const test = require('node:test');

const { createTestApp } = require('../setup/createTestApp');
const invokeApp = require('../setup/invokeApp');

test('GET /ready retorna pronto quando o banco responde', async () => {
  const { app } = createTestApp({ databaseAvailable: true });

  const response = await invokeApp(app, { url: '/ready' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ready');
  assert.equal(response.body.dependencies.database, 'up');
});

test('GET /ready retorna 503 quando o banco não responde', async () => {
  const { app } = createTestApp({ databaseAvailable: false });

  const response = await invokeApp(app, { url: '/ready' });

  assert.equal(response.status, 503);
  assert.equal(response.body.status, 'not_ready');
  assert.equal(response.body.dependencies.database, 'down');
});
