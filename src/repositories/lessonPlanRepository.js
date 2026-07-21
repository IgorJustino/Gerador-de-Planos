const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePagination(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0
    ? Number(page)
    : DEFAULT_PAGE;
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

async function createLessonPlan(db, {
  userId,
  tema,
  nivelEnsino,
  duracaoMinutos,
  codigoBNCC = null,
  status = 'draft',
  content,
  aiModel = null,
  promptVersion = null,
}) {
  const result = await db.query(
    `
      INSERT INTO lesson_plans (
        user_id,
        tema,
        nivel_ensino,
        duracao_minutos,
        codigo_bncc,
        status,
        content,
        ai_model,
        prompt_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      userId,
      tema,
      nivelEnsino,
      duracaoMinutos,
      codigoBNCC,
      status,
      content,
      aiModel,
      promptVersion,
    ]
  );

  return result.rows[0];
}

async function findLessonPlansByUser(db, userId, pagination = {}) {
  const { page, limit, offset } = normalizePagination(
    pagination.page,
    pagination.limit
  );
  const result = await db.query(
    `
      SELECT *
      FROM lesson_plans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  return {
    plans: result.rows,
    page,
    limit,
  };
}

async function findLessonPlanByIdAndUser(db, id, userId) {
  const result = await db.query(
    `
      SELECT *
      FROM lesson_plans
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [id, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createLessonPlan,
  findLessonPlansByUser,
  findLessonPlanByIdAndUser,
  normalizePagination,
};
