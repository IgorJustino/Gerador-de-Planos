exports.up = (pgm) => {
  pgm.sql('CREATE INDEX lesson_plans_user_id_idx ON lesson_plans (user_id)');
  pgm.sql('CREATE INDEX lesson_plans_created_at_idx ON lesson_plans (created_at DESC)');
  pgm.sql('CREATE INDEX lesson_plans_status_idx ON lesson_plans (status)');
  pgm.sql('CREATE INDEX lesson_plans_codigo_bncc_idx ON lesson_plans (codigo_bncc)');

  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  pgm.sql(`
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);

  pgm.sql(`
    CREATE TRIGGER lesson_plans_set_updated_at
    BEFORE UPDATE ON lesson_plans
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS lesson_plans_set_updated_at ON lesson_plans');
  pgm.sql('DROP TRIGGER IF EXISTS users_set_updated_at ON users');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at()');
  pgm.sql('DROP INDEX IF EXISTS lesson_plans_codigo_bncc_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plans_status_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plans_created_at_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plans_user_id_idx');
};
