function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function createUser(db, { name, email, passwordHash, role = 'teacher' }) {
  const normalizedEmail = normalizeEmail(email);
  const result = await db.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at
    `,
    [name, normalizedEmail, passwordHash, role]
  );

  return result.rows[0];
}

// password_hash só é retornado para o serviço interno de autenticação.
async function findUserByEmail(db, email) {
  const result = await db.query(
    `
      SELECT id, name, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] || null;
}

async function findUserById(db, id) {
  const result = await db.query(
    `
      SELECT id, name, email, role, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  normalizeEmail,
};
