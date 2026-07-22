const assert = require('node:assert/strict');
const test = require('node:test');

const { createValidLessonPlanContent } = require('../fixtures/lessonPlanContent');
const { buildLessonPlanPrompt } = require('../../src/services/promptBuilder');
const { validateLessonPlanContent } = require('../../src/schemas/geminiSchemas');
const { calculateLessonPlanQuality } = require('../../src/services/lessonPlanQualityService');

const disciplineCases = [
  ['História', 'Revolução Francesa'],
  ['Biologia', 'Fotossíntese'],
  ['Química', 'Ligações químicas'],
  ['Matemática', 'Função quadrática'],
  ['Português', 'Artigo de opinião'],
  ['Geografia', 'Urbanização'],
  ['Física', 'Leis de Newton'],
];

test('contrato lesson-plan-v7 permanece utilizável em sete disciplinas', () => {
  for (const [disciplina, tema] of disciplineCases) {
    const prompt = buildLessonPlanPrompt({
      tema,
      nivelEnsino: 'Ensino Médio',
      etapaEnsino: 'Ensino Médio',
      serieAno: '1ª série',
      disciplina,
      duracaoMinutos: 50,
      quantidadeAulas: 1,
    });
    const content = createValidLessonPlanContent({
      titulo: `${disciplina}: ${tema}`,
      resumo: `Plano investigativo de ${tema} com análise, produção e síntese dos estudantes.`,
    });

    assert.match(prompt, new RegExp(tema));
    assert.match(prompt, new RegExp(disciplina));
    assert.equal(validateLessonPlanContent(content, 50).success, true, disciplina);
    assert.equal(calculateLessonPlanQuality(content, 50).disponivel, true, disciplina);
  }
});
