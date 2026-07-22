function createValidLessonPlanContent(overrides = {}) {
  return {
    titulo: 'Fotossíntese em sala',
    resumo: 'Plano investigativo sobre como as plantas transformam luz em energia.',
    objetivos: [
      {
        id: 'OBJ-1',
        descricao: 'Identificar os elementos necessários para a fotossíntese',
        evidencia: 'Diagrama anotado pelo estudante',
        criterioSucesso: 'Identifica corretamente luz, água e gás carbônico',
      },
      {
        id: 'OBJ-2',
        descricao: 'Explicar a transformação de energia durante a fotossíntese',
        evidencia: 'Resposta individual de quatro linhas',
        criterioSucesso: 'Relaciona energia luminosa à produção de glicose',
      },
    ],
    metodologia: ['Investigação guiada com análise de diagrama e síntese individual'],
    recursos: ['Quadro', 'Diagrama da fotossíntese'],
    etapas: [
      {
        titulo: 'Problematização',
        descricao: 'Os estudantes registram hipóteses sobre como as plantas obtêm energia.',
        duracaoMinutos: 10,
        objetivosRelacionados: ['OBJ-1'],
        produtoDoEstudante: 'Hipótese inicial registrada',
      },
      {
        titulo: 'Análise do processo',
        descricao: 'Em duplas, os estudantes analisam e anotam um diagrama da fotossíntese.',
        duracaoMinutos: 30,
        objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
        produtoDoEstudante: 'Diagrama anotado',
      },
      {
        titulo: 'Síntese individual',
        descricao: 'Cada estudante explica a transformação de energia observada no processo.',
        duracaoMinutos: 10,
        objetivosRelacionados: ['OBJ-2'],
        produtoDoEstudante: 'Resposta individual de quatro linhas',
      },
    ],
    avaliacoes: [
      {
        instrumento: 'Diagrama anotado e resposta individual',
        objetivosRelacionados: ['OBJ-1', 'OBJ-2'],
        criterioSucesso: 'Adequado: identifica os elementos e explica a energia; parcial: identifica parte dos elementos; insuficiente: não usa evidências do diagrama',
      },
    ],
    adaptacoes: ['Oferecer diagrama ampliado e descrição textual equivalente'],
    habilidadesBNCC: [],
    ...overrides,
  };
}

module.exports = {
  createValidLessonPlanContent,
};
