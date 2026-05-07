-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "height" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "age" INTEGER,
    "sex" TEXT,
    "experienceLevel" TEXT,
    "goal" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "tdee" DOUBLE PRECISION,
    "targetCalories" DOUBLE PRECISION,
    "targetProtein" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealName" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetCalories" DOUBLE PRECISION NOT NULL,
    "targetProtein" DOUBLE PRECISION NOT NULL,
    "targetCarbs" DOUBLE PRECISION,
    "targetFat" DOUBLE PRECISION,

    CONSTRAINT "scheduled_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT,
    "barWeightKg" DOUBLE PRECISION,

    CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "rpe" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION NOT NULL,
    "rawInput" TEXT,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "diet_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mood" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "energyLevel" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "scheduled_meals_userId_idx" ON "scheduled_meals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_catalog_name_key" ON "exercise_catalog"("name");

-- CreateIndex
CREATE INDEX "workout_logs_userId_exerciseId_date_idx" ON "workout_logs"("userId", "exerciseId", "date");

-- CreateIndex
CREATE INDEX "diet_logs_userId_date_idx" ON "diet_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "daily_checkins_userId_date_idx" ON "daily_checkins"("userId", "date");

-- AddForeignKey
ALTER TABLE "scheduled_meals" ADD CONSTRAINT "scheduled_meals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_logs" ADD CONSTRAINT "diet_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
