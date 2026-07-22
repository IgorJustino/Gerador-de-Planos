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

function unitVector(index) {
  return Array.from({ length: 768 }, (_, position) => (position === index ? 1 : 0));
}

test('endpoints BNCC e geração RAG registram habilidades usadas', {
  skip: !testDatabaseUrl,
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `bncc-rag-${suffix}@example.com`;
  const env = getEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: 'bncc-rag-test-secret',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'test-model',
    EMBEDDING_DIMENSION: '768',
    GENERATION_RATE_LIMIT_MAX: '50',
  });
  const pool = createPool(env);
  let promptUsed = '';
  const app = createApp({
    env,
    pool,
    embeddingService: {
      async generateEmbedding() {
        return unitVector(0);
      },
    },
    geminiService: {
      async generateStructuredLessonPlan({ prompt }) {
        promptUsed = prompt;
        return {
          model: 'test-model',
          promptVersion: 'lesson-plan-v1',
          content: createValidLessonPlanContent({
            titulo: 'Plano com BNCC',
            habilidadesBNCC: [
              { codigo: 'EF05CI01', descricao: 'Habilidade usada como referência.' },
            ],
          }),
        };
      },
    },
  });

  try {
    const register = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: { nome: 'BNCC RAG', email, senha: 'senha1234' },
    });
    const cookie = extractCookie(register);

    const search = await invokeApp(app, {
      url: '/api/bncc/search?q=energia&limit=5',
      headers: { cookie },
    });
    assert.equal(search.status, 200);
    assert.equal(search.body.items[0].code, 'EF05CI01');
    const skill = search.body.items[0];

    const byCode = await invokeApp(app, {
      url: '/api/bncc/EF05CI01',
      headers: { cookie },
    });
    assert.equal(byCode.status, 200);
    assert.equal(byCode.body.skill.id, skill.id);

    const semantic = await invokeApp(app, {
      method: 'POST',
      url: '/api/bncc/semantic-search',
      headers: { cookie },
      body: { query: 'aula sobre energia', limit: 3 },
    });
    assert.equal(semantic.status, 200);
    assert.equal(semantic.body.items[0].code, 'EF05CI01');

    const generated = await invokeApp(app, {
      method: 'POST',
      url: '/api/planos/gerar',
      headers: { cookie },
      body: {
        tema: 'Fotossíntese',
        nivelEnsino: '5º ano',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05CI01',
        bnccSkillId: skill.id,
      },
    });
    assert.equal(generated.status, 201);
    assert.match(promptUsed, /<contexto_bncc>/);
    assert.match(promptUsed, /Código: EF05CI01/);
    assert.equal(generated.body.plano.habilidadesBNCCUsadas[0].code, 'EF05CI01');
    assert.equal(generated.body.plano.habilidadesBNCCUsadas[0].relationSource, 'selected');

    const fetched = await invokeApp(app, {
      url: `/api/planos/${generated.body.plano.id}`,
      headers: { cookie },
    });
    assert.equal(fetched.body.plano.habilidadesBNCCUsadas[0].code, 'EF05CI01');
  } finally {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await pool.end();
  }
});
