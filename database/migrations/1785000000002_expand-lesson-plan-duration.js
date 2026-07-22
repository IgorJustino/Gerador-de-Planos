exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE lesson_plans
      DROP CONSTRAINT IF EXISTS lesson_plans_duration_check,
      ADD CONSTRAINT lesson_plans_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 6000)
  `);

  pgm.sql(`
    ALTER TABLE lesson_plan_versions
      DROP CONSTRAINT IF EXISTS lesson_plan_versions_duration_check,
      ADD CONSTRAINT lesson_plan_versions_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 6000)
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE lesson_plan_versions
      DROP CONSTRAINT IF EXISTS lesson_plan_versions_duration_check,
      ADD CONSTRAINT lesson_plan_versions_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 300)
  `);

  pgm.sql(`
    ALTER TABLE lesson_plans
      DROP CONSTRAINT IF EXISTS lesson_plans_duration_check,
      ADD CONSTRAINT lesson_plans_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 300)
  `);
};
