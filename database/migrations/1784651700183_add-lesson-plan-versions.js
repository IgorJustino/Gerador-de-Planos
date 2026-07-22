/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql('ALTER TABLE lesson_plans ADD COLUMN current_version INTEGER');

  pgm.sql(`
    CREATE TABLE lesson_plan_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      source VARCHAR(20) NOT NULL,
      tema VARCHAR(255) NOT NULL,
      nivel_ensino VARCHAR(100) NOT NULL,
      duracao_minutos INTEGER NOT NULL,
      codigo_bncc VARCHAR(50),
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT lesson_plan_versions_number_check
        CHECK (version_number > 0),
      CONSTRAINT lesson_plan_versions_source_check
        CHECK (source IN ('ai', 'manual')),
      CONSTRAINT lesson_plan_versions_duration_check
        CHECK (duracao_minutos > 0 AND duracao_minutos <= 300),
      CONSTRAINT lesson_plan_versions_plan_number_unique
        UNIQUE (lesson_plan_id, version_number)
    )
  `);

  pgm.sql(`
    INSERT INTO lesson_plan_versions (
      lesson_plan_id,
      version_number,
      source,
      tema,
      nivel_ensino,
      duracao_minutos,
      codigo_bncc,
      content,
      created_at
    )
    SELECT
      id,
      1,
      'ai',
      tema,
      nivel_ensino,
      duracao_minutos,
      codigo_bncc,
      content,
      created_at
    FROM lesson_plans
  `);

  pgm.sql('UPDATE lesson_plans SET current_version = 1 WHERE current_version IS NULL');
  pgm.sql('ALTER TABLE lesson_plans ALTER COLUMN current_version SET DEFAULT 1');
  pgm.sql('ALTER TABLE lesson_plans ALTER COLUMN current_version SET NOT NULL');
  pgm.sql(`
    ALTER TABLE lesson_plans
    ADD CONSTRAINT lesson_plans_current_version_check
    CHECK (current_version > 0)
  `);

  pgm.sql('CREATE INDEX lesson_plan_versions_plan_id_idx ON lesson_plan_versions (lesson_plan_id)');
  pgm.sql('CREATE INDEX lesson_plan_versions_plan_version_desc_idx ON lesson_plan_versions (lesson_plan_id, version_number DESC)');
  pgm.sql('CREATE INDEX lesson_plan_versions_created_at_idx ON lesson_plan_versions (created_at DESC)');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_versions_created_at_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_versions_plan_version_desc_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_versions_plan_id_idx');
  pgm.sql('DROP TABLE IF EXISTS lesson_plan_versions');
  pgm.sql('ALTER TABLE lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_current_version_check');
  pgm.sql('ALTER TABLE lesson_plans DROP COLUMN IF EXISTS current_version');
};
