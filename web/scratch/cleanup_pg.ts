import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:ekkogalus1324@db.hbhxaosefziohrsrxldj.supabase.co:5432/postgres'
  });

  await client.connect();
  console.log('Connected to Database');

  const res = await client.query("SELECT id FROM users WHERE name ILIKE '%Lucas%'");
  const ids = res.rows.map(r => r.id);

  if (ids.length === 0) {
    console.log('User Lucas not found');
    await client.end();
    return;
  }

  console.log(`Deleting all data for user IDs: ${ids.join(', ')}`);

  // Delete everything in order to respect foreign keys if any (though Prisma usually handles this, we are in raw SQL)
  await client.query('DELETE FROM diet_logs WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM workout_logs WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM daily_checkins WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM exercise_prs WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM scheduled_meals WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM user_insights WHERE "userId" = ANY($1)', [ids]);
  await client.query('DELETE FROM users WHERE id = ANY($1)', [ids]);

  console.log('User Lucas and all associated data have been permanently removed.');
  await client.end();
}

main().catch(console.error);
