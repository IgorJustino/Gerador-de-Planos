/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE lesson_plan_feedbacks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      useful BOOLEAN NOT NULL,
      used_in_class BOOLEAN,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT lesson_plan_feedbacks_rating_check CHECK (rating BETWEEN 1 AND 5),
      CONSTRAINT lesson_plan_feedbacks_comment_length_check CHECK (comment IS NULL OR char_length(comment) <= 1000),
      CONSTRAINT lesson_plan_feedbacks_plan_user_unique UNIQUE (lesson_plan_id, user_id)
    )
  `);

  pgm.sql(`
    CREATE TRIGGER set_lesson_plan_feedbacks_updated_at
    BEFORE UPDATE ON lesson_plan_feedbacks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);

  pgm.sql('CREATE INDEX lesson_plan_feedbacks_plan_id_idx ON lesson_plan_feedbacks (lesson_plan_id)');
  pgm.sql('CREATE INDEX lesson_plan_feedbacks_user_id_idx ON lesson_plan_feedbacks (user_id)');
  pgm.sql('CREATE INDEX lesson_plan_feedbacks_created_at_idx ON lesson_plan_feedbacks (created_at DESC)');
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_feedbacks_created_at_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_feedbacks_user_id_idx');
  pgm.sql('DROP INDEX IF EXISTS lesson_plan_feedbacks_plan_id_idx');
  pgm.sql('DROP TRIGGER IF EXISTS set_lesson_plan_feedbacks_updated_at ON lesson_plan_feedbacks');
  pgm.sql('DROP TABLE IF EXISTS lesson_plan_feedbacks');
};
