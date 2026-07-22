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
  ...args
}) {
  const { createLessonPlanWithInitialVersion } = require('./lessonPlanVersionRepository');
  return createLessonPlanWithInitialVersion(db, args);
}

async function findLessonPlansByUser(db, userId, pagination = {}) {
  const { page, limit, offset } = normalizePagination(
    pagination.page,
    pagination.limit
  );
  const filters = [];
  const values = [userId];

  function addFilter(sql, value) {
    values.push(value);
    filters.push(sql.replace('?', `$${values.length}`));
  }

  if (pagination.status) {
    addFilter('status = ?', pagination.status);
  }

  if (pagination.nivelEnsino) {
    addFilter('nivel_ensino ILIKE ?', `%${pagination.nivelEnsino}%`);
  }

  if (pagination.codigoBNCC) {
    addFilter('codigo_bncc ILIKE ?', `%${pagination.codigoBNCC}%`);
  }

  if (pagination.tema) {
    addFilter('tema ILIKE ?', `%${pagination.tema}%`);
  }

  const sortMap = {
    created_desc: 'created_at DESC',
    created_asc: 'created_at ASC',
    updated_desc: 'updated_at DESC',
    updated_asc: 'updated_at ASC',
  };
  const orderBy = sortMap[pagination.sort] || sortMap.created_desc;
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const filterSql = filters.length > 0 ? `AND ${filters.join(' AND ')}` : '';

  const result = await db.query(
    `
      SELECT *
        , COUNT(*) OVER() AS total_count
      FROM lesson_plans
      WHERE user_id = $1
        ${filterSql}
      ORDER BY ${orderBy}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values
  );

  const total = result.rows.length > 0 ? Number(result.rows[0].total_count || 0) : 0;
  const plans = result.rows.map(({ total_count: _totalCount, ...plan }) => plan);

  return {
    plans,
    page,
    limit,
    total,
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

async function updateLessonPlanStatus(db, id, userId, status) {
  const result = await db.query(
    `
      UPDATE lesson_plans
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `,
    [status, id, userId]
  );

  return result.rows[0] || null;
}

async function deleteLessonPlanByIdAndUser(db, id, userId) {
  const result = await db.query(
    `
      DELETE FROM lesson_plans
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [id, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createLessonPlan,
  findLessonPlansByUser,
  findLessonPlanByIdAndUser,
  updateLessonPlanStatus,
  deleteLessonPlanByIdAndUser,
  normalizePagination,
};
