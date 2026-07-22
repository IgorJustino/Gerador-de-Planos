const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalizePagination(page = DEFAULT_PAGE, limit = DEFAULT_LIMIT) {
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : DEFAULT_PAGE;
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Math.min(Number(limit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

function mapSkill(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    educationStage: row.education_stage,
    schoolYear: row.school_year,
    subject: row.subject,
    thematicUnit: row.thematic_unit,
    knowledgeObject: row.knowledge_object,
    description: row.description,
    source: row.source,
    sourceVersion: row.source_version,
    score: row.score === undefined || row.score === null ? null : Number(row.score),
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

async function searchSkills(db, filters = {}) {
  const { page, limit, offset } = normalizePagination(filters.page, filters.limit);
  const values = [];
  const clauses = [];

  function addClause(sql, value) {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    values.push(pattern, pattern, pattern, pattern, pattern);
    const start = values.length - 4;
    clauses.push(`(
      code ILIKE $${start}
      OR subject ILIKE $${start + 1}
      OR education_stage ILIKE $${start + 2}
      OR school_year ILIKE $${start + 3}
      OR description ILIKE $${start + 4}
    )`);
  }

  if (filters.code) addClause('code ILIKE ?', `%${filters.code}%`);
  if (filters.subject) addClause('subject ILIKE ?', `%${filters.subject}%`);
  if (filters.educationStage) addClause('education_stage ILIKE ?', `%${filters.educationStage}%`);
  if (filters.schoolYear) addClause('school_year ILIKE ?', `%${filters.schoolYear}%`);

  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await db.query(
    `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM bncc_skills
      ${where}
      ORDER BY code ASC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `,
    values
  );

  return {
    items: result.rows.map(({ total_count: _totalCount, ...row }) => mapSkill(row)),
    page,
    limit,
    total: result.rows.length > 0 ? Number(result.rows[0].total_count || 0) : 0,
  };
}

async function findSkillByCode(db, code) {
  const result = await db.query(
    'SELECT * FROM bncc_skills WHERE code = $1 LIMIT 1',
    [code]
  );
  return mapSkill(result.rows[0]);
}

async function findSkillById(db, id) {
  const result = await db.query(
    'SELECT * FROM bncc_skills WHERE id = $1 LIMIT 1',
    [id]
  );
  return mapSkill(result.rows[0]);
}

async function semanticSearch(db, embedding, limit = 5) {
  const vector = `[${embedding.join(',')}]`;
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const result = await db.query(
    `
      SELECT *,
        1 - (embedding <=> $1::vector) AS score
      FROM bncc_skills
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `,
    [vector, safeLimit]
  );
  return result.rows.map(mapSkill);
}

async function updateSkillEmbedding(db, id, embedding) {
  const vector = `[${embedding.join(',')}]`;
  const result = await db.query(
    'UPDATE bncc_skills SET embedding = $1::vector, updated_at = NOW() WHERE id = $2 RETURNING *',
    [vector, id]
  );
  return mapSkill(result.rows[0]);
}

async function attachSkillsToPlan(db, planId, skills = []) {
  if (!skills.length) return [];
  const result = [];

  for (const skill of skills) {
    const inserted = await db.query(
      `
        INSERT INTO lesson_plan_bncc_skills (
          lesson_plan_id,
          bncc_skill_id,
          relevance_score,
          source
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (lesson_plan_id, bncc_skill_id)
        DO UPDATE SET
          relevance_score = EXCLUDED.relevance_score,
          source = EXCLUDED.source
        RETURNING *
      `,
      [planId, skill.id, skill.score ?? null, skill.source]
    );
    result.push(inserted.rows[0]);
  }

  return result;
}

async function findSkillsByPlan(db, planId) {
  const result = await db.query(
    `
      SELECT bs.*, lpbs.relevance_score AS score, lpbs.source AS relation_source
      FROM lesson_plan_bncc_skills lpbs
      JOIN bncc_skills bs ON bs.id = lpbs.bncc_skill_id
      WHERE lpbs.lesson_plan_id = $1
      ORDER BY lpbs.source ASC, lpbs.relevance_score DESC NULLS LAST, bs.code ASC
    `,
    [planId]
  );
  return result.rows.map((row) => ({
    ...mapSkill(row),
    relationSource: row.relation_source,
  }));
}

module.exports = {
  normalizePagination,
  mapSkill,
  searchSkills,
  findSkillByCode,
  findSkillById,
  semanticSearch,
  updateSkillEmbedding,
  attachSkillsToPlan,
  findSkillsByPlan,
};
