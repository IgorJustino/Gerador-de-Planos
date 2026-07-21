const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../../src/app');
const invokeApp = require('../setup/invokeApp');


function createMemoryDb() {
  const users = [];
  const plans = [];
  let userCounter = 0;
  let planCounter = 0;

  return {
    users,
    plans,
    async query(text, values = []) {
      if (text.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };

      if (text.includes('INSERT INTO users')) {
        const [name, email, passwordHash, role] = values;
        const user = {
          id: `00000000-0000-4000-8000-${String(++userCounter).padStart(12, '0')}`,
          name,
          email,
          password_hash: passwordHash,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        users.push(user);
        return { rows: [{ ...user, password_hash: undefined }] };
      }

      if (text.includes('password_hash') && text.includes('WHERE email')) {
        return { rows: users.filter((user) => user.email === values[0]) };
      }

      if (text.includes('SELECT id, name, email, role, created_at')) {
        return {
          rows: users
            .filter((user) => user.id === values[0])
            .map(({ password_hash: _hash, ...user }) => user),
        };
      }

      if (text.includes('INSERT INTO lesson_plans')) {
        const [userId, tema, nivelEnsino, duracaoMinutos, codigoBNCC, status, content, aiModel, promptVersion] = values;
        const plan = {
          id: `00000000-0000-4000-8000-${String(++planCounter).padStart(12, '0')}`,
          user_id: userId,
          tema,
          nivel_ensino: nivelEnsino,
          duracao_minutos: duracaoMinutos,
          codigo_bncc: codigoBNCC,
          status,
          content,
          ai_model: aiModel,
          prompt_version: promptVersion,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        plans.push(plan);
        return { rows: [plan] };
      }

      if (text.includes('FROM lesson_plans') && text.includes('COUNT(*) OVER')) {
        const rows = plans
          .filter((plan) => plan.user_id === values[0])
          .slice(values[2], values[2] + values[1])
          .map((plan) => ({ ...plan, total_count: plans.filter((item) => item.user_id === values[0]).length }));
        return { rows };
      }

      if (text.includes('FROM lesson_plans') && text.includes('id = $1')) {
        return { rows: plans.filter((plan) => plan.id === values[0] && plan.user_id === values[1]) };
      }

      throw new Error(`Query não suportada no banco de teste: ${text}`);
    },
    async end() {},
  };
}

function createTestApp() {
  const db = createMemoryDb();
  const env = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: 'postgresql://test',
    databasePoolMax: 1,
    databaseSsl: false,
    corsOrigin: 'http://localhost:3000',
    jwtSecret: 'test-secret-only',
    jwtExpiresIn: '1h',
    jwtExpiresInMs: 60 * 60 * 1000,
    cookieName: 'copiloto_session',
    cookieSecure: false,
    cookieSameSite: 'lax',
    authLoginRateLimitMax: 100,
    authRegisterRateLimitMax: 100,
    authRateLimitWindowMs: 60 * 1000,
    generationRateLimitMax: 100,
    generationRateLimitWindowMs: 60 * 1000,
    geminiApiKey: 'test-key',
    geminiModel: 'test-model',
    geminiTimeoutMs: 100,
    geminiMaxRetries: 1,
  };
  const content = {
    titulo: 'Plano de teste',
    resumo: 'Resumo suficientemente longo para o schema do plano.',
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
  const geminiService = {
    async generateStructuredLessonPlan() {
      return { content, model: 'test-model', promptVersion: 'lesson-plan-v1', latencyMs: 1 };
    },
  };

  return { app: createApp({ env, pool: db, geminiService }), db };
}

test('fluxo moderno gera, lista e isola planos por usuário', async () => {
  const { app, db } = createTestApp();
  const first = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: { nome: 'Professora A', email: 'a@example.com', senha: 'senha123' },
  });
  const second = await invokeApp(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: { nome: 'Professor B', email: 'b@example.com', senha: 'senha123' },
  });
  const firstSetCookie = Array.isArray(first.headers['set-cookie'])
    ? first.headers['set-cookie'][0]
    : first.headers['set-cookie'];
  const secondSetCookie = Array.isArray(second.headers['set-cookie'])
    ? second.headers['set-cookie'][0]
    : second.headers['set-cookie'];
  const firstCookie = firstSetCookie.split(';')[0];
  const secondCookie = secondSetCookie.split(';')[0];

  const generated = await invokeApp(app, {
    method: 'POST',
    url: '/api/planos/gerar',
    headers: { cookie: firstCookie },
    body: {
      tema: 'Fotossíntese',
      nivelEnsino: '5º ano',
      duracaoMinutos: 50,
      codigoBNCC: 'EF05CI01',
    },
  });

  assert.equal(generated.status, 201);
  assert.equal(db.plans.length, 1);
  assert.equal(generated.body.plano.status, 'draft');
  assert.equal(generated.body.plano.conteudo.titulo, 'Plano de teste');

  const ownList = await invokeApp(app, {
    url: '/api/planos?page=1&limit=10',
    headers: { cookie: firstCookie },
  });
  const otherList = await invokeApp(app, {
    url: '/api/planos',
    headers: { cookie: secondCookie },
  });
  const crossAccess = await invokeApp(app, {
    url: `/api/planos/${generated.body.plano.id}`,
    headers: { cookie: secondCookie },
  });

  assert.equal(ownList.status, 200);
  assert.equal(ownList.body.pagination.total, 1);
  assert.equal(ownList.body.items.length, 1);
  assert.equal(otherList.body.items.length, 0);
  assert.equal(crossAccess.status, 404);
});

test('geração sem autenticação não chama o serviço de planos', async () => {
  const { app, db } = createTestApp();
  const response = await invokeApp(app, {
    method: 'POST',
    url: '/api/planos/gerar',
    body: { tema: 'Teste', nivelEnsino: '5º ano', duracaoMinutos: 50 },
  });

  assert.equal(response.status, 401);
  assert.equal(db.plans.length, 0);
});
