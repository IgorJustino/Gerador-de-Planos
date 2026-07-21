exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT,
      role VARCHAR(32) NOT NULL DEFAULT 'teacher',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (role IN ('teacher', 'admin'))
    )
  `);

  pgm.sql('CREATE INDEX users_email_lower_idx ON users (LOWER(email))');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS users');
};
