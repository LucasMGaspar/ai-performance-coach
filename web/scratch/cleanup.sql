DELETE FROM "DietLog" WHERE "userId" IN (SELECT id FROM "User" WHERE name ILIKE '%Lucas%');
DELETE FROM "WorkoutLog" WHERE "userId" IN (SELECT id FROM "User" WHERE name ILIKE '%Lucas%');
DELETE FROM "DailyCheckIn" WHERE "userId" IN (SELECT id FROM "User" WHERE name ILIKE '%Lucas%');
DELETE FROM "ExercisePR" WHERE "userId" IN (SELECT id FROM "User" WHERE name ILIKE '%Lucas%');
