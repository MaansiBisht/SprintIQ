import { query } from '../config/db';

// Frequency map key format: "dimension:value" → count
export type ProfileMap = Map<string, number>;

export async function rebuildDeveloperProfiles(): Promise<void> {
  // Full rebuild inside a transaction: delete stale data, re-aggregate from resolved ticket history
  await query('BEGIN');
  try {
    await query('DELETE FROM developer_profiles');

    await query(`
      INSERT INTO developer_profiles (developer_id, dimension, value, count, updated_at)
      SELECT developer_id, dimension, value, count::integer, NOW()
      FROM (
        SELECT assignee_id AS developer_id, 'type' AS dimension, type AS value, COUNT(*) AS count
        FROM tickets
        WHERE status IN ('Done', 'Closed')
          AND assignee_id IS NOT NULL
          AND type IS NOT NULL AND type <> ''
        GROUP BY assignee_id, type

        UNION ALL

        SELECT assignee_id, 'label', label_val, COUNT(*)
        FROM tickets, unnest(labels) AS label_val
        WHERE status IN ('Done', 'Closed')
          AND assignee_id IS NOT NULL
          AND label_val <> ''
        GROUP BY assignee_id, label_val

        UNION ALL

        SELECT assignee_id, 'component', comp_val, COUNT(*)
        FROM tickets, unnest(components) AS comp_val
        WHERE status IN ('Done', 'Closed')
          AND assignee_id IS NOT NULL
          AND comp_val <> ''
        GROUP BY assignee_id, comp_val
      ) sub
      WHERE developer_id IN (SELECT id FROM developers)
      ON CONFLICT (developer_id, dimension, value)
        DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
    `);

    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

export async function loadDeveloperProfiles(developerIds: string[]): Promise<Map<string, ProfileMap>> {
  if (developerIds.length === 0) return new Map();

  const result = await query(
    'SELECT developer_id, dimension, value, count FROM developer_profiles WHERE developer_id = ANY($1)',
    [developerIds]
  );

  const outer = new Map<string, ProfileMap>();
  for (const row of result.rows) {
    if (!outer.has(row.developer_id)) outer.set(row.developer_id, new Map());
    outer.get(row.developer_id)!.set(`${row.dimension}:${row.value}`, parseInt(row.count, 10));
  }
  return outer;
}
