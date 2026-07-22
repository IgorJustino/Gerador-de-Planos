async function withTransaction(db, callback) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const release = typeof client.release === 'function' ? () => client.release() : () => {};

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Preserva o erro original da operação.
    }
    throw error;
  } finally {
    release();
  }
}

module.exports = {
  withTransaction,
};
