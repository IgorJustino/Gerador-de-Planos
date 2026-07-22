const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
const {
  lessonPlanGenerationSchema,
  lessonPlanUpdateSchema,
  lessonPlanStatusSchema,
} = require('../../src/schemas/lessonPlanSchemas');
const {
  STATUS_TRANSITIONS,
  mergeLessonPlanChanges,
  createLessonPlanService,
} = require('../../src/services/lessonPlanService');

const currentPlan = {
  id: 'plan-1',
  tema: 'Fotossíntese',
  nivel_ensino: '5º ano',
  duracao_minutos: 50,
  codigo_bncc: 'EF05CI01',
  status: 'draft',
  current_version: 1,
  content: createValidLessonPlanContent({ titulo: 'Plano atual' }),
};

test('schema de edição exige alteração e permite remover código BNCC', () => {
  const valid = lessonPlanUpdateSchema.safeParse({
    codigoBNCC: null,
    expectedVersion: 1,
  });
  assert.equal(valid.success, true);

  const onlyVersion = lessonPlanUpdateSchema.safeParse({ expectedVersion: 1 });
  assert.equal(onlyVersion.success, false);

  const withForbiddenField = lessonPlanUpdateSchema.safeParse({
    tema: 'Novo tema',
    expectedVersion: 1,
    status: 'approved',
  });
  assert.equal(withForbiddenField.success, false);
});

test('schemas aceitam códigos BNCC do Ensino Fundamental e Médio', () => {
  assert.equal(
    lessonPlanGenerationSchema.safeParse({
      tema: 'Alexandre e o mundo helenístico',
      nivelEnsino: 'Ensino Médio',
      duracaoMinutos: 50,
      codigoBNCC: 'EM13CHS101',
    }).success,
    true
  );

  assert.equal(
    lessonPlanUpdateSchema.safeParse({
      codigoBNCC: 'EF05CI01',
      expectedVersion: 1,
    }).success,
    true
  );
});

test('schema de status rejeita campos extras e status desconhecido', () => {
  assert.equal(lessonPlanStatusSchema.safeParse({ status: 'approved' }).success, true);
  assert.equal(lessonPlanStatusSchema.safeParse({ status: 'deleted' }).success, false);
  assert.equal(
    lessonPlanStatusSchema.safeParse({ status: 'draft', expectedVersion: 1 }).success,
    false
  );
});

test('mescla campos parciais sem alterar o snapshot original', () => {
  const merged = mergeLessonPlanChanges(currentPlan, {
    tema: 'Fotossíntese revisada',
    codigoBNCC: null,
    expectedVersion: 1,
  });

  assert.equal(merged.tema, 'Fotossíntese revisada');
  assert.equal(merged.nivelEnsino, '5º ano');
  assert.equal(merged.codigoBNCC, null);
  assert.deepEqual(merged.content, currentPlan.content);
  assert.equal(currentPlan.tema, 'Fotossíntese');
  assert.equal(currentPlan.codigo_bncc, 'EF05CI01');
});

test('expõe somente transições de status permitidas', () => {
  assert.equal(STATUS_TRANSITIONS.draft.has('reviewed'), true);
  assert.equal(STATUS_TRANSITIONS.approved.has('draft'), false);
  assert.equal(STATUS_TRANSITIONS.archived.has('draft'), true);
});

test('serviço traduz conflito de versão em erro de domínio', async () => {
  const repository = {
    async findLessonPlanByIdAndUser() {
      return currentPlan;
    },
  };
  const versionRepository = {
    async createVersionAndUpdateCurrentPlan() {
      return { outcome: 'version_conflict', currentVersion: 2 };
    },
  };
  const service = createLessonPlanService({
    db: {},
    geminiService: {},
    repository,
    versionRepository,
  });

  await assert.rejects(
    service.updateLessonPlan({
      userId: 'user-1',
      id: 'plan-1',
      expectedVersion: 1,
      changes: { tema: 'Novo tema' },
    }),
    { code: 'VERSION_CONFLICT', statusCode: 409 }
  );
});

test('serviço bloqueia duração incompatível sem criar versão', async () => {
  let versionCreationCalled = false;
  const repository = {
    async findLessonPlanByIdAndUser() {
      return currentPlan;
    },
  };
  const versionRepository = {
    async createVersionAndUpdateCurrentPlan() {
      versionCreationCalled = true;
      return { outcome: 'success', plan: currentPlan };
    },
  };
  const service = createLessonPlanService({
    db: {},
    geminiService: {},
    repository,
    versionRepository,
  });

  await assert.rejects(
    service.updateLessonPlan({
      userId: 'user-1',
      id: 'plan-1',
      expectedVersion: 1,
      changes: { duracaoMinutos: 100 },
    }),
    { code: 'INVALID_PLAN_DURATION', statusCode: 400 }
  );
  assert.equal(versionCreationCalled, false);
});
