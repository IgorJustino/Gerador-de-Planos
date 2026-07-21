const assert = require('node:assert/strict');
const test = require('node:test');

const { createAuthTestApp } = require('../setup/createAuthTestApp');
const invokeApp = require('../setup/invokeApp');

function cookieFrom(response, cookieName = 'copiloto_session') {
  const value = getSetCookie(response);
  return value.split(';')[0].replace(`${cookieName}=`, '');
}

function getSetCookie(response) {
  const setCookie = response.headers['set-cookie'];
  return Array.isArray(setCookie) ? setCookie[0] : setCookie;
}

test('cadastro cria teacher, define cookie e não retorna JWT', async () => {
  const { app, db } = createAuthTestApp();

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      nome: 'Maria da Silva',
      email: 'Maria@Example.COM',
      senha: 'senha1234',
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.role, 'teacher');
  assert.equal(response.body.user.email, 'maria@example.com');
  assert.equal(response.body.token, undefined);
  assert.equal(response.body.user.password_hash, undefined);
  assert.match(getSetCookie(response), /HttpOnly/);
  assert.match(getSetCookie(response), /SameSite=Lax/);
  assert.notEqual(db.users[0].password_hash, 'senha1234');
});

test('cadastro rejeita role enviado pelo cliente', async () => {
  const { app, db } = createAuthTestApp();

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      nome: 'Admin indevido',
      email: 'admin@example.com',
      senha: 'senha1234',
      role: 'admin',
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(db.users.length, 0);
});

test('login usa mensagem genérica e sessão consulta usuário pelo cookie', async () => {
  const { app } = createAuthTestApp();

  const registerResponse = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      nome: 'Maria',
      email: 'maria@example.com',
      senha: 'senha1234',
    },
  });
  const sessionCookie = cookieFrom(registerResponse);

  const loginResponse = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'maria@example.com', senha: 'senha-errada' },
  });
  assert.equal(loginResponse.status, 401);
  assert.equal(loginResponse.body.error.message, 'Credenciais inválidas');

  const meResponse = await invokeApp(app, {
    url: '/api/auth/me',
    headers: { cookie: `copiloto_session=${sessionCookie}` },
  });
  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.user.email, 'maria@example.com');

  const unauthorizedResponse = await invokeApp(app, { url: '/api/auth/me' });
  assert.equal(unauthorizedResponse.status, 401);
  assert.equal(unauthorizedResponse.body.error.code, 'UNAUTHORIZED');
});

test('logout limpa o cookie sem exigir sessão válida', async () => {
  const { app } = createAuthTestApp();

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/logout',
  });

  assert.equal(response.status, 204);
  assert.match(getSetCookie(response), /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(getSetCookie(response), /HttpOnly/);
  assert.match(getSetCookie(response), /SameSite=Lax/);
});

test('rate limit bloqueia tentativas excedentes de login', async () => {
  const { app } = createAuthTestApp({ loginRateLimitMax: 1 });

  await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'a@example.com', senha: 'senha1234' },
  });
  const response = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'a@example.com', senha: 'senha1234' },
  });

  assert.equal(response.status, 429);
  assert.equal(response.body.error.code, 'RATE_LIMIT_EXCEEDED');
});
