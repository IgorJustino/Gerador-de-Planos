exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE lesson_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tema VARCHAR(255) NOT NULL,
      nivel_ensino VARCHAR(100) NOT NULL,
      duracao_minutos INTEGER NOT NULL,
      codigo_bncc VARCHAR(50),
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      content JSONB NOT NULL,
      ai_model VARCHAR(100),
      prompt_version VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT lesson_plans_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 300),
      CONSTRAINT lesson_plans_status_check
        CHECK (status IN ('draft', 'reviewed', 'approved', 'archived'))
    )
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS lesson_plans');
};
