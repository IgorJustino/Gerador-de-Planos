const assert = require('node:assert/strict');
const test = require('node:test');

const { getEnv } = require('../../src/config/env');
const { createPool } = require('../../src/config/database');
const { createApp } = require('../../src/app');
const {
  createVersionAndUpdateCurrentPlan,
  findVersionsByPlanAndUser,
  findVersionByNumberAndUser,
} = require('../../src/repositories/lessonPlanVersionRepository');
const invokeApp = require('../setup/invokeApp');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('fluxo de planos persiste no PostgreSQL de teste', {
  skip: !testDatabaseUrl,
}, async () => {
  const email = `postgres-${Date.now()}@example.com`;
  const env = getEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: 'postgres-test-secret',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'test-model',
    GENERATION_RATE_LIMIT_MAX: '20',
  });
  const pool = createPool(env);
  const content = {
    titulo: 'Plano PostgreSQL',
    resumo: 'Resumo suficientemente longo para validar a persistência real.',
    objetivos: ['Compreender o conteúdo'],
    metodologia: ['Atividade guiada'],
    recursos: ['Quadro'],
    etapas: [
      { titulo: 'Introdução', descricao: 'Apresentação do tema.', duracaoMinutos: 10 },
      { titulo: 'Desenvolvimento', descricao: 'Atividade principal.', duracaoMinutos: 30 },
      { titulo: 'Fechamento', descricao: 'Síntese da aula.', duracaoMinutos: 10 },
    ],
    avaliacao: ['Participação'],
    adaptacoes: [],
    habilidadesBNCC: [],
  };
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
    const register = await invokeApp(app, {
      method: 'POST',
      url: '/api/auth/register',
      body: { nome: 'PostgreSQL Teste', email, senha: 'senha1234' },
    });
    const setCookie = Array.isArray(register.headers['set-cookie'])
      ? register.headers['set-cookie'][0]
      : register.headers['set-cookie'];
    const cookie = setCookie.split(';')[0];

    const response = await invokeApp(app, {
      method: 'POST',
      url: '/api/planos/gerar',
      headers: { cookie },
      body: {
        tema: 'Fotossíntese',
        nivelEnsino: '5º ano',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05CI01',
      },
    });

    assert.equal(register.status, 201);
    assert.equal(response.status, 201);
    assert.equal(response.body.plano.conteudo.titulo, 'Plano PostgreSQL');

    const stored = await pool.query(
      'SELECT user_id, content, ai_model, prompt_version, current_version FROM lesson_plans WHERE id = $1',
      [response.body.plano.id]
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].content.titulo, 'Plano PostgreSQL');
    assert.equal(stored.rows[0].ai_model, 'test-model');
    assert.equal(stored.rows[0].prompt_version, 'lesson-plan-v1');
    assert.equal(stored.rows[0].current_version, 1);

    const initialVersion = await pool.query(
      `
        SELECT version_number, source, tema, nivel_ensino, duracao_minutos,
               codigo_bncc, content
        FROM lesson_plan_versions
        WHERE lesson_plan_id = $1
        ORDER BY version_number
      `,
      [response.body.plano.id]
    );
    assert.equal(initialVersion.rows.length, 1);
    assert.equal(initialVersion.rows[0].version_number, 1);
    assert.equal(initialVersion.rows[0].source, 'ai');
    assert.deepEqual(initialVersion.rows[0].content, content);

    const versionTwo = await createVersionAndUpdateCurrentPlan(pool, {
      planId: response.body.plano.id,
      userId: register.body.user.id,
      source: 'manual',
      tema: 'Fotossíntese revisada',
      nivelEnsino: '5º ano',
      duracaoMinutos: 45,
      codigoBNCC: 'EF05CI01',
      content: { ...content, titulo: 'Plano revisado' },
    });
    assert.equal(versionTwo.version.versionNumber, 2);

    const [concurrentA, concurrentB] = await Promise.all([
      createVersionAndUpdateCurrentPlan(pool, {
        planId: response.body.plano.id,
        userId: register.body.user.id,
        source: 'manual',
        tema: 'Versão concorrente A',
        nivelEnsino: '5º ano',
        duracaoMinutos: 40,
        content: { ...content, titulo: 'Versão A' },
      }),
      createVersionAndUpdateCurrentPlan(pool, {
        planId: response.body.plano.id,
        userId: register.body.user.id,
        source: 'manual',
        tema: 'Versão concorrente B',
        nivelEnsino: '5º ano',
        duracaoMinutos: 40,
        content: { ...content, titulo: 'Versão B' },
      }),
    ]);
    assert.deepEqual(
      [concurrentA.version.versionNumber, concurrentB.version.versionNumber].sort(),
      [3, 4]
    );

    const current = await pool.query(
      'SELECT current_version, tema, content FROM lesson_plans WHERE id = $1',
      [response.body.plano.id]
    );
    assert.equal(current.rows[0].current_version, 4);
    assert.equal(current.rows[0].content.titulo, current.rows[0].tema === 'Versão concorrente A'
      ? 'Versão A'
      : 'Versão B');

    const versions = await findVersionsByPlanAndUser(
      pool,
      response.body.plano.id,
      register.body.user.id,
      { page: 1, limit: 20 }
    );
    assert.equal(versions.total, 4);
    assert.deepEqual(versions.versions.map((item) => item.versionNumber), [4, 3, 2, 1]);
    assert.equal(
      (await findVersionByNumberAndUser(
        pool,
        response.body.plano.id,
        1,
        register.body.user.id
      )).versionNumber,
      1
    );
    assert.equal(
      await findVersionByNumberAndUser(pool, response.body.plano.id, 1, '00000000-0000-4000-8000-000000000099'),
      null
    );

    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    const afterCascade = await pool.query(
      'SELECT COUNT(*)::int AS count FROM lesson_plan_versions WHERE lesson_plan_id = $1',
      [response.body.plano.id]
    );
    assert.equal(afterCascade.rows[0].count, 0);
  } finally {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    await pool.end();
  }
});
