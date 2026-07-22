function mapFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    lessonPlanId: row.lesson_plan_id,
    userId: row.user_id,
    rating: row.rating,
    useful: row.useful,
    usedInClass: row.used_in_class,
    comment: row.comment,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  };
}

async function upsertFeedback(db, {
  lessonPlanId,
  userId,
  rating,
  useful,
  usedInClass = null,
  comment = null,
}) {
  const result = await db.query(
    `
      INSERT INTO lesson_plan_feedbacks (
        lesson_plan_id,
        user_id,
        rating,
        useful,
        used_in_class,
        comment
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (lesson_plan_id, user_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        useful = EXCLUDED.useful,
        used_in_class = EXCLUDED.used_in_class,
        comment = EXCLUDED.comment,
        updated_at = NOW()
      RETURNING *
    `,
    [lessonPlanId, userId, rating, useful, usedInClass, comment]
  );

  return mapFeedback(result.rows[0]);
}

async function findFeedbackByPlanAndUser(db, lessonPlanId, userId) {
  const result = await db.query(
    `
      SELECT *
      FROM lesson_plan_feedbacks
      WHERE lesson_plan_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [lessonPlanId, userId]
  );

  return mapFeedback(result.rows[0]);
}

module.exports = {
  upsertFeedback,
  findFeedbackByPlanAndUser,
  mapFeedback,
};
