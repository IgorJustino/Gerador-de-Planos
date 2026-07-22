const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
const createLessonPlanEditor = require('../../public/js/lessonPlanEditor');

const editor = createLessonPlanEditor({
    normalizePlan(plan) {
        return {
            ...plan,
            conteudo: plan.conteudo || {},
            codigoBNCC: plan.codigoBNCC || '',
            versaoAtual: plan.versaoAtual || 1,
        };
    },
});

function basePlan() {
    return {
        id: 'plan-1',
        tema: 'Fotossíntese',
        nivelEnsino: '5 ano',
        duracaoMinutos: 50,
        codigoBNCC: 'EF05CI01',
        versaoAtual: 2,
        conteudo: {
            titulo: 'Fotossíntese',
            resumo: 'Resumo suficiente do plano.',
            objetivos: ['Compreender o processo'],
            metodologia: ['Exposição dialogada'],
            recursos: ['Quadro'],
            etapas: [
                { titulo: 'Introdução', descricao: 'Conversa inicial.', duracaoMinutos: 10 },
                { titulo: 'Desenvolvimento', descricao: 'Atividade prática.', duracaoMinutos: 40 },
            ],
            avaliacao: ['Participação'],
            adaptacoes: [],
            habilidadesBNCC: [
                { codigo: 'EF05CI01', descricao: 'Habilidade informada' },
            ],
        },
    };
}

test('editor cria payload minimo com expectedVersion e campo alterado', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    draft.tema = 'Fotossíntese e energia';

    const result = editor.buildUpdatePayload(basePlan(), draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.payload, {
        expectedVersion: 2,
        tema: 'Fotossíntese e energia',
    });
});

test('editor diferencia codigo BNCC ausente de codigo removido', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    draft.codigoBNCC = '';

    const result = editor.buildUpdatePayload(basePlan(), draft);

    assert.equal(result.valid, true);
    assert.equal(result.payload.codigoBNCC, null);
});

test('editor aceita código BNCC do Ensino Médio', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    draft.codigoBNCC = 'EM13CHS101';

    const result = editor.buildUpdatePayload(basePlan(), draft);

    assert.equal(result.valid, true);
    assert.equal(result.payload.codigoBNCC, 'EM13CHS101');
});

test('editor rejeita formulario sem alteracoes', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    const result = editor.buildUpdatePayload(basePlan(), draft);

    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /Não há alterações/);
});

test('editor valida formato das etapas antes de enviar', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    draft.conteudo.etapas = 'Abertura | dez | Texto';

    const result = editor.buildUpdatePayload(basePlan(), draft);

    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /formato/);
});

test('editor converte listas e habilidades para conteudo estruturado', () => {
    const draft = editor.createDraftFromPlan(basePlan());
    draft.conteudo.objetivos = 'Objetivo A\nObjetivo B';
    draft.conteudo.habilidadesBNCC = 'EF05CI01 | Descrição da habilidade';

    const content = editor.contentFromDraft(draft);

    assert.deepEqual(content.objetivos, ['Objetivo A', 'Objetivo B']);
    assert.deepEqual(content.habilidadesBNCC, [
        { codigo: 'EF05CI01', descricao: 'Descrição da habilidade' },
    ]);
});

test('editor preserva o contrato v2 ao editar metadados', () => {
    const plan = {
        ...basePlan(),
        conteudo: createValidLessonPlanContent(),
    };
    const draft = editor.createDraftFromPlan(plan);
    draft.tema = 'Fotossíntese investigativa';

    const result = editor.buildUpdatePayload(plan, draft);

    assert.equal(result.valid, true);
    assert.deepEqual(result.payload, {
        expectedVersion: 2,
        tema: 'Fotossíntese investigativa',
    });
    assert.deepEqual(editor.contentFromDraft(draft), plan.conteudo);
});

test('editor rejeita referências quebradas no contrato v2', () => {
    const plan = {
        ...basePlan(),
        conteudo: createValidLessonPlanContent(),
    };
    const draft = editor.createDraftFromPlan(plan);
    draft.conteudo.etapas = draft.conteudo.etapas.replace('OBJ-1', 'OBJ-99');

    const result = editor.buildUpdatePayload(plan, draft);

    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /objetivos existentes/);
});
