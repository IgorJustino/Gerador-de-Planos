const fs = require('fs');
const path = require('path');

const { getEnv, validateEnv } = require('../../src/config/env');
const { createPool } = require('../../src/config/database');

async function run() {
  const env = validateEnv(getEnv(), { requireDatabase: true });
  const pool = createPool(env);
  const seedDirectory = __dirname;
  const seedFiles = fs
    .readdirSync(seedDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  try {
    for (const seedFile of seedFiles) {
      const sql = fs.readFileSync(path.join(seedDirectory, seedFile), 'utf8');
      await pool.query(sql);
      console.log(`[seed] Executado: ${seedFile}`);
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('[seed] Falha:', error.message);
  process.exitCode = 1;
});
