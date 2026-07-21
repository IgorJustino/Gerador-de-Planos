const assert = require('node:assert/strict');
const test = require('node:test');

const { createTestApp } = require('../setup/createTestApp');
const invokeApp = require('../setup/invokeApp');

test('rota inexistente passa pelo tratamento centralizado de erros', async () => {
  const { app } = createTestApp();
  const response = await invokeApp(app, { url: '/rota-inexistente' });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});
