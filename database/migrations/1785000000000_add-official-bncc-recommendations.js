exports.shorthands = undefined;

const source = 'BNCC MEC - Ensino Médio 2018';

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE bncc_skills
    SET subject = 'Ciências Humanas e Sociais Aplicadas',
        thematic_unit = 'Tempo e espaço',
        knowledge_object = 'Fontes e processos históricos',
        description = 'Analisar e comparar diferentes fontes e narrativas expressas em diversas linguagens, com vistas à compreensão e à crítica de ideias filosóficas e processos e eventos históricos, geográficos, políticos, econômicos, sociais, ambientais e culturais.',
        source = '${source}',
        source_version = '2018'
    WHERE code = 'EM13CHS101'
  `);

  pgm.sql(`
    INSERT INTO bncc_skills (
      code, education_stage, school_year, subject, thematic_unit,
      knowledge_object, description, source, source_version
    )
    VALUES
      (
        'EM13CHS103', 'Ensino Médio', NULL,
        'Ciências Humanas e Sociais Aplicadas', 'Tempo e espaço',
        'Evidências e argumentação',
        'Elaborar hipóteses, selecionar evidências e compor argumentos relativos a processos políticos, econômicos, sociais, ambientais, culturais e epistemológicos, com base na sistematização de dados e informações de natureza qualitativa e quantitativa.',
        '${source}', '2018'
      ),
      (
        'EM13CHS104', 'Ensino Médio', NULL,
        'Ciências Humanas e Sociais Aplicadas', 'Tempo e espaço',
        'Cultura material e imaterial',
        'Analisar objetos da cultura material e imaterial como suporte de conhecimentos, valores, crenças e práticas que singularizam diferentes sociedades inseridas no tempo e no espaço.',
        '${source}', '2018'
      ),
      (
        'EM13CHS204', 'Ensino Médio', NULL,
        'Ciências Humanas e Sociais Aplicadas', 'Território e fronteira',
        'Ocupação do espaço e formação de territórios',
        'Comparar e avaliar os processos de ocupação do espaço e a formação de territórios, territorialidades e fronteiras, identificando o papel de diferentes agentes e considerando os conflitos populacionais, a diversidade étnico-cultural e as características socioeconômicas, políticas e tecnológicas.',
        '${source}', '2018'
      )
    ON CONFLICT (code) DO UPDATE SET
      subject = EXCLUDED.subject,
      thematic_unit = EXCLUDED.thematic_unit,
      knowledge_object = EXCLUDED.knowledge_object,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      source_version = EXCLUDED.source_version
  `);

  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 10 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EM13CHS103'
  `);
  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 11 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EM13CHS104'
  `);
  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 12 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EM13CHS204'
  `);
};

exports.down = (pgm) => {
  pgm.sql("DELETE FROM bncc_skills WHERE code IN ('EM13CHS103', 'EM13CHS104', 'EM13CHS204')");
  pgm.sql(`
    UPDATE bncc_skills
    SET subject = 'Ciências Humanas',
        thematic_unit = 'Tempo e espaço',
        knowledge_object = 'Análise de processos históricos',
        description = 'Analisar processos políticos, econômicos, sociais e culturais em diferentes tempos e espaços.',
        source = 'Seed fictício de demonstração',
        source_version = 'demo-2026-07'
    WHERE code = 'EM13CHS101'
  `);
};
