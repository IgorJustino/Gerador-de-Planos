const assert = require('node:assert/strict');
const test = require('node:test');

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

const content = {
  titulo: 'Plano de produto',
  resumo: 'Resumo suficientemente longo para validar métricas e feedback.',
  objetivos: ['Compreender o tema'],
  metodologia: ['Atividade orientada'],
  recursos: ['Quadro'],
  etapas: [
    { titulo: 'Abertura', descricao: 'Introdução.', duracaoMinutos: 10 },
    { titulo: 'Prática', descricao: 'Atividade.', duracaoMinutos: 40 },
  ],
  avaliacao: ['Participação'],
  adaptacoes: [],
  habilidadesBNCC: [],
};

test('filtros, feedback e métricas usam dados reais e isolamento por usuário', {
  skip: !testDatabaseUrl,
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emailA = `product-a-${suffix}@example.com`;
  const emailB = `product-b-${suffix}@example.com`;
  const env = getEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: 'product-summary-test-secret',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'test-model',
    GENERATION_RATE_LIMIT_MAX: '50',
  });
  const pool = createPool(env);
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
      body: { nome: 'Produto A', email: emailA, senha: 'senha1234' },
    });
    const cookieA = extractCookie(registerA);

    const registerB = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: { nome: 'Produto B', email: emailB, senha: 'senha1234' },
    });
    const cookieB = extractCookie(registerB);

    const generatedA = await invokeApp(app, {
      method: 'POST',
      url: '/api/planos/gerar',
      headers: { cookie: cookieA },
      body: {
        tema: 'Matemática financeira',
        nivelEnsino: 'Ensino Médio',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05CI01',
      },
    });
    const planA = generatedA.body.plano;

    const generatedB = await invokeApp(app, {
      method: 'POST',
      url: '/api/planos/gerar',
      headers: { cookie: cookieB },
      body: {
        tema: 'História antiga',
        nivelEnsino: 'Ensino Fundamental',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05HI01',
      },
    });
    assert.notEqual(generatedB.body.plano.id, planA.id);

    await invokeApp(app, {
      method: 'PATCH',
      url: `/api/planos/${planA.id}/status`,
      headers: { cookie: cookieA },
      body: { status: 'reviewed' },
    });

    const filtered = await invokeApp(app, {
      url: '/api/planos?tema=financeira&status=reviewed&codigoBNCC=EF05CI01&sort=updated_desc',
      headers: { cookie: cookieA },
    });
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.items.length, 1);
    assert.equal(filtered.body.items[0].id, planA.id);

    const isolated = await invokeApp(app, {
      url: '/api/planos?tema=financeira',
      headers: { cookie: cookieB },
    });
    assert.equal(isolated.body.items.length, 0);

    const invalidFilter = await invokeApp(app, {
      url: '/api/planos?status=invalid',
      headers: { cookie: cookieA },
    });
    assert.equal(invalidFilter.status, 400);

    const feedback = await invokeApp(app, {
      method: 'POST',
      url: `/api/planos/${planA.id}/feedback`,
      headers: { cookie: cookieA },
      body: {
        rating: 5,
        useful: true,
        usedInClass: false,
        comment: 'Plano útil para ajuste em aula.',
      },
    });
    assert.equal(feedback.status, 200);
    assert.equal(feedback.body.feedback.rating, 5);

    const updatedFeedback = await invokeApp(app, {
      method: 'POST',
      url: `/api/planos/${planA.id}/feedback`,
      headers: { cookie: cookieA },
      body: {
        rating: 4,
        useful: true,
        usedInClass: true,
        comment: 'Usei em aula.',
      },
    });
    assert.equal(updatedFeedback.body.feedback.rating, 4);
    assert.equal(updatedFeedback.body.feedback.usedInClass, true);

    const forbiddenFeedback = await invokeApp(app, {
      method: 'POST',
      url: `/api/planos/${planA.id}/feedback`,
      headers: { cookie: cookieB },
      body: { rating: 3, useful: false },
    });
    assert.equal(forbiddenFeedback.status, 404);

    const invalidFeedback = await invokeApp(app, {
      method: 'POST',
      url: `/api/planos/${planA.id}/feedback`,
      headers: { cookie: cookieA },
      body: { rating: 6, useful: true },
    });
    assert.equal(invalidFeedback.status, 400);

    const metricsA = await invokeApp(app, {
      url: '/api/metrics/summary',
      headers: { cookie: cookieA },
    });
    assert.equal(metricsA.status, 200);
    assert.equal(metricsA.body.metrics.totalPlanos, 1);
    assert.equal(metricsA.body.metrics.planosPorStatus.reviewed, 1);
    assert.equal(metricsA.body.metrics.totalFeedbacks, 1);
    assert.equal(metricsA.body.metrics.notaMedia, 4);
    assert.equal(metricsA.body.metrics.percentualUteis, 100);

    const metricsB = await invokeApp(app, {
      url: '/api/metrics/summary',
      headers: { cookie: cookieB },
    });
    assert.equal(metricsB.body.metrics.totalPlanos, 1);
    assert.equal(metricsB.body.metrics.totalFeedbacks, 0);

    await invokeApp(app, {
      method: 'DELETE',
      url: `/api/planos/${planA.id}`,
      headers: { cookie: cookieA },
    });
    const feedbackCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lesson_plan_feedbacks WHERE lesson_plan_id = $1',
      [planA.id]
    );
    assert.equal(feedbackCount.rows[0].count, 0);
  } finally {
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [emailA, emailB]);
    await pool.end();
  }
});
