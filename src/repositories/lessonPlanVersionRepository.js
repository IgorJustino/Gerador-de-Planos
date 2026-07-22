const { withTransaction } = require('./transaction');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const VERSION_SOURCES = new Set(['ai', 'manual']);

function normalizePagination(page = 1, limit = DEFAULT_LIMIT) {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0
    ? Number(page)
    : 1;
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

function assertSource(source) {
  if (!VERSION_SOURCES.has(source)) {
    const error = new Error('Origem de versão inválida');
    error.code = 'INVALID_VERSION_SOURCE';
    throw error;
  }
}

function mapVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    lessonPlanId: row.lesson_plan_id,
    versionNumber: row.version_number,
    source: row.source,
    tema: row.tema,
    nivelEnsino: row.nivel_ensino,
    duracaoMinutos: row.duracao_minutos,
    codigoBNCC: row.codigo_bncc,
    content: row.content,
    criadoEm: row.created_at,
  };
}

async function createLessonPlanWithInitialVersion(db, {
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
  const result = await withTransaction(db, async (client) => {
    const planResult = await client.query(
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
          prompt_version,
          current_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
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
    const plan = planResult.rows[0];

    await client.query(
      `
        INSERT INTO lesson_plan_versions (
          lesson_plan_id,
          version_number,
          source,
          tema,
          nivel_ensino,
          duracao_minutos,
          codigo_bncc,
          content
        )
        VALUES ($1, 1, 'ai', $2, $3, $4, $5, $6)
      `,
      [plan.id, tema, nivelEnsino, duracaoMinutos, codigoBNCC, content]
    );

    return plan;
  });

  return result;
}

async function createVersionAndUpdateCurrentPlan(db, {
  planId,
  userId,
  source,
  tema,
  nivelEnsino,
  duracaoMinutos,
  codigoBNCC = null,
  content,
}) {
  assertSource(source);

  return withTransaction(db, async (client) => {
    const planResult = await client.query(
      `
        SELECT *
        FROM lesson_plans
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [planId, userId]
    );

    const currentPlan = planResult.rows[0];
    if (!currentPlan) return null;

    const nextVersion = currentPlan.current_version + 1;
    const versionResult = await client.query(
      `
        INSERT INTO lesson_plan_versions (
          lesson_plan_id,
          version_number,
          source,
          tema,
          nivel_ensino,
          duracao_minutos,
          codigo_bncc,
          content
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [planId, nextVersion, source, tema, nivelEnsino, duracaoMinutos, codigoBNCC, content]
    );

    const updatedPlanResult = await client.query(
      `
        UPDATE lesson_plans
        SET tema = $1,
            nivel_ensino = $2,
            duracao_minutos = $3,
            codigo_bncc = $4,
            content = $5,
            current_version = $6,
            updated_at = NOW()
        WHERE id = $7 AND user_id = $8
        RETURNING *
      `,
      [tema, nivelEnsino, duracaoMinutos, codigoBNCC, content, nextVersion, planId, userId]
    );

    return {
      plan: updatedPlanResult.rows[0],
      version: mapVersion(versionResult.rows[0]),
    };
  });
}

async function findVersionsByPlanAndUser(db, planId, userId, pagination = {}) {
  const { page, limit, offset } = normalizePagination(pagination.page, pagination.limit);
  const result = await db.query(
    `
      SELECT lpv.*, COUNT(*) OVER() AS total_count
      FROM lesson_plan_versions lpv
      INNER JOIN lesson_plans lp ON lp.id = lpv.lesson_plan_id
      WHERE lpv.lesson_plan_id = $1 AND lp.user_id = $2
      ORDER BY lpv.version_number DESC
      LIMIT $3 OFFSET $4
    `,
    [planId, userId, limit, offset]
  );
  const total = result.rows.length > 0 ? Number(result.rows[0].total_count || 0) : 0;

  return {
    versions: result.rows.map(({ total_count: _totalCount, ...row }) => mapVersion(row)),
    page,
    limit,
    total,
  };
}

async function findVersionByNumberAndUser(db, planId, versionNumber, userId) {
  const result = await db.query(
    `
      SELECT lpv.*
      FROM lesson_plan_versions lpv
      INNER JOIN lesson_plans lp ON lp.id = lpv.lesson_plan_id
      WHERE lpv.lesson_plan_id = $1
        AND lpv.version_number = $2
        AND lp.user_id = $3
      LIMIT 1
    `,
    [planId, versionNumber, userId]
  );

  return mapVersion(result.rows[0]);
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizePagination,
  mapVersion,
  createLessonPlanWithInitialVersion,
  createVersionAndUpdateCurrentPlan,
  findVersionsByPlanAndUser,
  findVersionByNumberAndUser,
};
