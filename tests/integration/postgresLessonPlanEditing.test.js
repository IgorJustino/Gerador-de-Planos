const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
const { getEnv } = require('../../src/config/env');
const { createPool } = require('../../src/config/database');
const { createApp } = require('../../src/app');
const invokeApp = require('../setup/invokeApp');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function extractCookie(response) {
  const setCookie = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie'][0]
    : response.headers['set-cookie'];
  return setCookie.split(';')[0];
}

test('API de edição, versões, status e exclusão usa snapshots e isolamento', {
  skip: !testDatabaseUrl,
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emailA = `editing-a-${suffix}@example.com`;
  const emailB = `editing-b-${suffix}@example.com`;
  const env = getEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: 'postgres-editing-test-secret',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'test-model',
    GENERATION_RATE_LIMIT_MAX: '20',
  });
  const pool = createPool(env);
  const content = createValidLessonPlanContent({ titulo: 'Plano para edição' });
  const app = createApp({
    env,
    pool,
    geminiService: {
      async generateStructuredLessonPlan() {
        return { content, model: 'test-model', promptVersion: 'lesson-plan-v1' };
      },
    },
  });

  try {
    const registerA = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: { nome: 'Editora A', email: emailA, senha: 'senha1234' },
    });
    const cookieA = extractCookie(registerA);
    const userA = registerA.body.user.id;

    const generated = await invokeApp(app, {
      method: 'POST',
      url: '/api/planos/gerar',
      headers: { cookie: cookieA },
      body: {
        tema: 'Fotossíntese',
        nivelEnsino: '5º ano',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05CI01',
      },
    });
    const planId = generated.body.plano.id;

    const edited = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}`,
      headers: { cookie: cookieA },
      body: {
        tema: 'Fotossíntese revisada',
        expectedVersion: 1,
      },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.plano.tema, 'Fotossíntese revisada');
    assert.equal(edited.body.plano.versaoAtual, 2);

    const removedBncc = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}`,
      headers: { cookie: cookieA },
      body: {
        codigoBNCC: null,
        expectedVersion: 2,
      },
    });
    assert.equal(removedBncc.status, 200);
    assert.equal(removedBncc.body.plano.codigoBNCC, null);
    assert.equal(removedBncc.body.plano.versaoAtual, 3);
    assert.deepEqual(removedBncc.body.plano.conteudo, content);

    const conflict = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}`,
      headers: { cookie: cookieA },
      body: {
        tema: 'Edição antiga',
        expectedVersion: 2,
      },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'VERSION_CONFLICT');

    const versionListPageOne = await invokeApp(app, {
      url: `/api/planos/${planId}/versoes?page=1&limit=2`,
      headers: { cookie: cookieA },
    });
    assert.equal(versionListPageOne.status, 200);
    assert.deepEqual(
      versionListPageOne.body.items.map((item) => item.versionNumber),
      [3, 2]
    );
    assert.deepEqual(versionListPageOne.body.pagination, {
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const versionListPageTwo = await invokeApp(app, {
      url: `/api/planos/${planId}/versoes?page=2&limit=2`,
      headers: { cookie: cookieA },
    });
    assert.deepEqual(versionListPageTwo.body.items.map((item) => item.versionNumber), [1]);

    const versionOne = await invokeApp(app, {
      url: `/api/planos/${planId}/versoes/1`,
      headers: { cookie: cookieA },
    });
    assert.equal(versionOne.status, 200);
    assert.equal(versionOne.body.versao.source, 'ai');
    assert.equal(versionOne.body.versao.versionNumber, 1);
    assert.equal(versionOne.body.versao.codigoBNCC, 'EF05CI01');

    const statusBefore = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lesson_plan_versions WHERE lesson_plan_id = $1',
      [planId]
    );
    const reviewed = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}/status`,
      headers: { cookie: cookieA },
      body: { status: 'reviewed' },
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.plano.status, 'reviewed');
    assert.equal(reviewed.body.plano.versaoAtual, 3);

    const repeatedStatus = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}/status`,
      headers: { cookie: cookieA },
      body: { status: 'reviewed' },
    });
    assert.equal(repeatedStatus.status, 200);

    const approved = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}/status`,
      headers: { cookie: cookieA },
      body: { status: 'approved' },
    });
    assert.equal(approved.status, 200);

    const invalidTransition = await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planId}/status`,
      headers: { cookie: cookieA },
      body: { status: 'draft' },
    });
    assert.equal(invalidTransition.status, 409);
    assert.equal(invalidTransition.body.error.code, 'INVALID_STATUS_TRANSITION');

    const statusAfter = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lesson_plan_versions WHERE lesson_plan_id = $1',
      [planId]
    );
    assert.equal(statusBefore.rows[0].count, statusAfter.rows[0].count);

    const registerB = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: { nome: 'Editora B', email: emailB, senha: 'senha1234' },
    });
    const cookieB = extractCookie(registerB);
    assert.notEqual(registerB.body.user.id, userA);

    for (const request of [
      { method: 'PATCH', url: `/api/planos/${planId}`, body: { tema: 'Acesso indevido', expectedVersion: 3 } },
      { method: 'PATCH', url: `/api/planos/${planId}/status`, body: { status: 'archived' } },
      { method: 'DELETE', url: `/api/planos/${planId}` },
      { method: 'GET', url: `/api/planos/${planId}/versoes` },
      { method: 'GET', url: `/api/planos/${planId}/versoes/1` },
    ]) {
      const response = await invokeApp(app, {
        ...request,
        headers: { cookie: cookieB },
      });
      assert.equal(response.status, 404, request.url);
    }

    const deleted = await invokeApp(app, {
      method: 'DELETE',
      url: `/api/planos/${planId}`,
      headers: { cookie: cookieA },
    });
    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, '');

    const cascade = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lesson_plan_versions WHERE lesson_plan_id = $1',
      [planId]
    );
    assert.equal(cascade.rows[0].count, 0);
  } finally {
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [emailA, emailB]);
    await pool.end();
  }
});
