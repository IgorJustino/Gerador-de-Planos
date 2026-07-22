exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql('ALTER TABLE lesson_plans ADD COLUMN etapa_ensino VARCHAR(100)');
  pgm.sql('ALTER TABLE lesson_plans ADD COLUMN serie_ano VARCHAR(50)');
  pgm.sql('ALTER TABLE lesson_plans ADD COLUMN disciplina VARCHAR(120)');
  pgm.sql('UPDATE lesson_plans SET etapa_ensino = nivel_ensino WHERE etapa_ensino IS NULL');
  pgm.sql('ALTER TABLE lesson_plan_versions ADD COLUMN etapa_ensino VARCHAR(100)');
  pgm.sql('ALTER TABLE lesson_plan_versions ADD COLUMN serie_ano VARCHAR(50)');
  pgm.sql('ALTER TABLE lesson_plan_versions ADD COLUMN disciplina VARCHAR(120)');
  pgm.sql('UPDATE lesson_plan_versions SET etapa_ensino = nivel_ensino WHERE etapa_ensino IS NULL');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE lesson_plan_versions DROP COLUMN IF EXISTS disciplina');
  pgm.sql('ALTER TABLE lesson_plan_versions DROP COLUMN IF EXISTS serie_ano');
  pgm.sql('ALTER TABLE lesson_plan_versions DROP COLUMN IF EXISTS etapa_ensino');
  pgm.sql('ALTER TABLE lesson_plans DROP COLUMN IF EXISTS disciplina');
  pgm.sql('ALTER TABLE lesson_plans DROP COLUMN IF EXISTS serie_ano');
  pgm.sql('ALTER TABLE lesson_plans DROP COLUMN IF EXISTS etapa_ensino');
};
