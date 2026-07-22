const assert = require('node:assert/strict');
const test = require('node:test');

const userRepository = require('../../src/repositories/userRepository');
const lessonPlanRepository = require('../../src/repositories/lessonPlanRepository');

function createFakeDb(rows = []) {
  const calls = [];

  return {
    calls,
    query: async (text, values) => {
      calls.push({ text, values });
      return { rows };
    },
  };
}

test('userRepository normaliza email e usa query parametrizada', async () => {
  const db = createFakeDb([{ id: 'user-1', email: 'prof@example.com' }]);

  const user = await userRepository.createUser(db, {
    name: 'Professora',
    email: '  Prof@Example.COM ',
    passwordHash: 'hash',
  });

  assert.equal(user.id, 'user-1');
  assert.deepEqual(db.calls[0].values, [
    'Professora',
    'prof@example.com',
    'hash',
    'teacher',
  ]);
  assert.match(db.calls[0].text, /INSERT INTO users/);
});

test('lessonPlanRepository mapeia camelCase para snake_case', async () => {
  const db = createFakeDb([{ id: 'plan-1' }]);

  const plan = await lessonPlanRepository.createLessonPlan(db, {
    userId: 'user-1',
    tema: 'Fotossíntese',
    nivelEnsino: '5º ano',
    duracaoMinutos: 50,
    codigoBNCC: 'EF05CI01',
    content: { titulo: 'Plano' },
    aiModel: 'test-model',
    promptVersion: 'v1',
  });

  assert.equal(plan.id, 'plan-1');
  const planInsert = db.calls.find((call) => call.text.includes('INSERT INTO lesson_plans'));
  assert.deepEqual(planInsert.values, [
      'user-1',
      'Fotossíntese',
      '5º ano',
      '5º ano',
      null,
      null,
      50,
    'EF05CI01',
    'draft',
    { titulo: 'Plano' },
    'test-model',
    'v1',
  ]);
  assert.match(planInsert.text, /nivel_ensino/);
  assert.match(planInsert.text, /codigo_bncc/);
  assert.match(db.calls[0].text, /BEGIN/);
  assert.match(db.calls.at(-1).text, /COMMIT/);
});

test('listagem aplica paginação e limita o tamanho máximo', async () => {
  const db = createFakeDb([]);

  const result = await lessonPlanRepository.findLessonPlansByUser(db, 'user-1', {
    page: 2,
    limit: 500,
  });

  assert.deepEqual(result, { plans: [], page: 2, limit: 100, total: 0 });
  assert.deepEqual(db.calls[0].values, ['user-1', 100, 100]);
  assert.match(db.calls[0].text, /WHERE user_id = \$1/);
});

test('consulta individual sempre filtra por usuário', async () => {
  const db = createFakeDb([{ id: 'plan-1', user_id: 'user-1' }]);

  const plan = await lessonPlanRepository.findLessonPlanByIdAndUser(
    db,
    'plan-1',
    'user-1'
  );

  assert.equal(plan.user_id, 'user-1');
  assert.deepEqual(db.calls[0].values, ['plan-1', 'user-1']);
  assert.match(db.calls[0].text, /user_id = \$2/);
});
