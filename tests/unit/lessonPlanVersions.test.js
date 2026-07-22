const assert = require('node:assert/strict');
const test = require('node:test');

const versionRepository = require('../../src/repositories/lessonPlanVersionRepository');

function createDb({ plan, version, failOnVersionInsert = false } = {}) {
  const calls = [];

  return {
    calls,
    async query(text, values = []) {
      calls.push({ text, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(text.trim())) return { rows: [] };
      if (text.includes('INSERT INTO lesson_plans')) return { rows: [plan] };
      if (text.includes('SELECT *') && text.includes('FOR UPDATE')) return { rows: plan ? [plan] : [] };
      if (text.includes('INSERT INTO lesson_plan_versions')) {
        if (failOnVersionInsert) throw new Error('falha simulada ao criar versão');
        return { rows: [version] };
      }
      if (text.includes('UPDATE lesson_plans')) return { rows: [plan] };

      throw new Error(`Query não suportada no teste: ${text}`);
    },
  };
}

const plan = {
  id: 'plan-1',
  user_id: 'user-1',
  current_version: 1,
};

const version = {
  id: 'version-1',
  lesson_plan_id: 'plan-1',
  version_number: 2,
  source: 'manual',
  tema: 'Novo tema',
  nivel_ensino: '5º ano',
  duracao_minutos: 50,
  codigo_bncc: 'EF05CI01',
  content: { titulo: 'Novo plano' },
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

test('normaliza paginação, limita o máximo e mapeia snapshot', () => {
  assert.deepEqual(versionRepository.normalizePagination(2, 500), {
    page: 2,
    limit: 100,
    offset: 100,
  });

  assert.deepEqual(versionRepository.mapVersion(version), {
    id: 'version-1',
    lessonPlanId: 'plan-1',
    versionNumber: 2,
    source: 'manual',
    tema: 'Novo tema',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
    codigoBNCC: 'EF05CI01',
    content: { titulo: 'Novo plano' },
    criadoEm: version.created_at,
  });
});

test('cria versão e atualiza plano dentro de transação com bloqueio', async () => {
  const db = createDb({ plan, version });

  const result = await versionRepository.createVersionAndUpdateCurrentPlan(db, {
    planId: 'plan-1',
    userId: 'user-1',
    source: 'manual',
    tema: 'Novo tema',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
    codigoBNCC: 'EF05CI01',
    content: { titulo: 'Novo plano' },
  });

  assert.equal(result.version.versionNumber, 2);
  assert.match(db.calls[0].text, /BEGIN/);
  assert.match(db.calls[1].text, /FOR UPDATE/);
  assert.match(db.calls.at(-1).text, /COMMIT/);
  assert.deepEqual(db.calls.at(-2).values, [
      'Novo tema',
      '5º ano',
      '5º ano',
      null,
      null,
      50,
    'EF05CI01',
    { titulo: 'Novo plano' },
    2,
    'plan-1',
    'user-1',
  ]);
});

test('rejeita origem de versão desconhecida antes de abrir transação', async () => {
  const db = createDb({ plan, version });

  await assert.rejects(
    versionRepository.createVersionAndUpdateCurrentPlan(db, {
      planId: 'plan-1',
      userId: 'user-1',
      source: 'imported',
      tema: 'Tema',
      nivelEnsino: '5º ano',
      duracaoMinutos: 50,
      content: { titulo: 'Plano' },
    }),
    { code: 'INVALID_VERSION_SOURCE' }
  );

  assert.equal(db.calls.length, 0);
});

test('faz rollback quando a inserção do snapshot falha', async () => {
  const db = createDb({ plan, version, failOnVersionInsert: true });

  await assert.rejects(
    versionRepository.createVersionAndUpdateCurrentPlan(db, {
      planId: 'plan-1',
      userId: 'user-1',
      source: 'manual',
      tema: 'Novo tema',
      nivelEnsino: '5º ano',
      duracaoMinutos: 50,
      content: { titulo: 'Novo plano' },
    }),
    /falha simulada/
  );

  assert.match(db.calls.at(-1).text, /ROLLBACK/);
});
