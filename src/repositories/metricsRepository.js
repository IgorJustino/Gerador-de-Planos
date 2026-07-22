async function getSummaryByUser(db, userId) {
  const [
    plans,
    statusCounts,
    versions,
    feedbacks,
    recentPlans,
    lastPlans,
  ] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM lesson_plans WHERE user_id = $1', [userId]),
    db.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM lesson_plans
        WHERE user_id = $1
        GROUP BY status
      `,
      [userId]
    ),
    db.query(
      `
        SELECT COUNT(lpv.id)::int AS total
        FROM lesson_plan_versions lpv
        JOIN lesson_plans lp ON lp.id = lpv.lesson_plan_id
        WHERE lp.user_id = $1
      `,
      [userId]
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          AVG(rating)::float AS average_rating,
          AVG(CASE WHEN useful THEN 1 ELSE 0 END)::float AS useful_ratio
        FROM lesson_plan_feedbacks
        WHERE user_id = $1
      `,
      [userId]
    ),
    db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM lesson_plans
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '7 days'
      `,
      [userId]
    ),
    db.query(
      `
        SELECT id, tema, status, created_at, updated_at
        FROM lesson_plans
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [userId]
    ),
  ]);

  return {
    totalPlans: plans.rows[0]?.total || 0,
    statusCounts: statusCounts.rows,
    totalVersions: versions.rows[0]?.total || 0,
    feedbacks: feedbacks.rows[0] || { total: 0, average_rating: null, useful_ratio: null },
    recentPlansLast7Days: recentPlans.rows[0]?.total || 0,
    latestPlans: lastPlans.rows,
  };
}

module.exports = {
  getSummaryByUser,
};
