/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS vector');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  pgm.sql(`
    CREATE TABLE bncc_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(50) UNIQUE NOT NULL,
      education_stage VARCHAR(100) NOT NULL,
      school_year VARCHAR(100),
      subject VARCHAR(120) NOT NULL,
      thematic_unit VARCHAR(200),
      knowledge_object TEXT,
      description TEXT NOT NULL,
      source VARCHAR(255),
      source_version VARCHAR(100),
      embedding vector(768),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  pgm.sql(`
    CREATE TRIGGER set_bncc_skills_updated_at
    BEFORE UPDATE ON bncc_skills
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);

  pgm.sql(`
    CREATE TABLE lesson_plan_bncc_skills (
      lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
      bncc_skill_id UUID NOT NULL REFERENCES bncc_skills(id),
      relevance_score NUMERIC,
      source VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (lesson_plan_id, bncc_skill_id),
      CONSTRAINT lesson_plan_bncc_skills_source_check
        CHECK (source IN ('selected', 'retrieved'))
    )
  `);

  pgm.sql('CREATE INDEX bncc_skills_code_idx ON bncc_skills (code)');
  pgm.sql('CREATE INDEX bncc_skills_subject_idx ON bncc_skills (subject)');
  pgm.sql('CREATE INDEX bncc_skills_stage_year_idx ON bncc_skills (education_stage, school_year)');
  pgm.sql('CREATE INDEX bncc_skills_description_trgm_idx ON bncc_skills USING gin (description gin_trgm_ops)');
  pgm.sql('CREATE INDEX lesson_plan_bncc_skills_skill_idx ON lesson_plan_bncc_skills (bncc_skill_id)');

  pgm.sql(`
    INSERT INTO bncc_skills (
      code,
      education_stage,
      school_year,
      subject,
      thematic_unit,
      knowledge_object,
      description,
      source,
      source_version
    )
    VALUES
      (
        'EF05CI01',
        'Ensino Fundamental',
        '5º ano',
        'Ciências',
        'Matéria e energia',
        'Propriedades físicas dos materiais',
        'Explorar fenômenos relacionados a transformações de materiais e energia em situações observáveis.',
        'Seed fictício de demonstração',
        'demo-2026-07'
      ),
      (
        'EF05CI02',
        'Ensino Fundamental',
        '5º ano',
        'Ciências',
        'Vida e evolução',
        'Nutrição do organismo',
        'Relacionar hábitos alimentares, saúde e funcionamento do corpo humano.',
        'Seed fictício de demonstração',
        'demo-2026-07'
      ),
      (
        'EF06MA01',
        'Ensino Fundamental',
        '6º ano',
        'Matemática',
        'Números',
        'Sistema de numeração decimal',
        'Resolver e elaborar problemas com números naturais e racionais em diferentes contextos.',
        'Seed fictício de demonstração',
        'demo-2026-07'
      ),
      (
        'EM13CHS101',
        'Ensino Médio',
        NULL,
        'Ciências Humanas',
        'Tempo e espaço',
        'Análise de processos históricos',
        'Analisar processos políticos, econômicos, sociais e culturais em diferentes tempos e espaços.',
        'Seed fictício de demonstração',
        'demo-2026-07'
      )
    ON CONFLICT (code) DO NOTHING
  `);

  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 1 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EF05CI01' AND embedding IS NULL
  `);

  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 2 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EF05CI02' AND embedding IS NULL
  `);

  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 3 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EF06MA01' AND embedding IS NULL
  `);

  pgm.sql(`
    UPDATE bncc_skills
    SET embedding = (
      '[' || array_to_string(ARRAY(
        SELECT CASE WHEN i = 4 THEN '1' ELSE '0' END
        FROM generate_series(1, 768) AS i
      ), ',') || ']'
    )::vector
    WHERE code = 'EM13CHS101' AND embedding IS NULL
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_bncc_skills_skill_idx');
  pgm.sql('DROP INDEX IF EXISTS bncc_skills_description_trgm_idx');
  pgm.sql('DROP INDEX IF EXISTS bncc_skills_stage_year_idx');
  pgm.sql('DROP INDEX IF EXISTS bncc_skills_subject_idx');
  pgm.sql('DROP INDEX IF EXISTS bncc_skills_code_idx');
  pgm.sql('DROP TABLE IF EXISTS lesson_plan_bncc_skills');
  pgm.sql('DROP TRIGGER IF EXISTS set_bncc_skills_updated_at ON bncc_skills');
  pgm.sql('DROP TABLE IF EXISTS bncc_skills');
  pgm.sql('DROP EXTENSION IF EXISTS vector');
  pgm.sql('DROP EXTENSION IF EXISTS pg_trgm');
};
