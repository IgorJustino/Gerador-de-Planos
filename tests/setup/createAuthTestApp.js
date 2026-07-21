const { createApp } = require('../../src/app');

function createMemoryDb() {
  const users = [];
  let nextId = 1;

  return {
    users,
    async query(text, values = []) {
      if (text.includes('SELECT 1')) {
        return { rows: [{ '?column?': 1 }] };
      }

      if (text.includes('INSERT INTO users')) {
        const [name, email, passwordHash, role] = values;
        const user = {
          id: `user-${nextId++}`,
          name,
          email,
          password_hash: passwordHash,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        users.push(user);
        return { rows: [{ ...user, password_hash: undefined }] };
      }

      if (text.includes('password_hash') && text.includes('WHERE email')) {
        return {
          rows: users.filter((user) => user.email === values[0]),
        };
      }

      if (text.includes('WHERE id = $1')) {
        return {
          rows: users
            .filter((user) => user.id === values[0])
            .map(({ password_hash: _passwordHash, ...publicUser }) => publicUser),
        };
      }

      throw new Error(`Query não suportada no banco de teste: ${text}`);
    },
    async end() {},
  };
}

function createAuthTestApp(options = {}) {
  const db = createMemoryDb();
  const env = {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: 'postgresql://test',
    databasePoolMax: 1,
    databaseSsl: false,
    corsOrigin: 'http://localhost:3000',
    jwtSecret: 'test-secret-only',
    jwtExpiresIn: '1h',
    jwtExpiresInMs: 60 * 60 * 1000,
    cookieName: 'copiloto_session',
    cookieSecure: false,
    cookieSameSite: 'lax',
    authLoginRateLimitMax: options.loginRateLimitMax || 100,
    authRegisterRateLimitMax: options.registerRateLimitMax || 100,
    authRateLimitWindowMs: 60 * 1000,
  };

  return { app: createApp({ env, pool: db }), db, env };
}

module.exports = {
  createAuthTestApp,
};
