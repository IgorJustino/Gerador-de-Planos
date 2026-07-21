exports.up = (pgm) => {
  pgm.sql('ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
};
