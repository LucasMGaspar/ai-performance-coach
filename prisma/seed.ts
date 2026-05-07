import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
  {
    name: "Supino Reto",
    aliases: ["bench press", "supino", "supino reto", "supino plano"],
    muscleGroup: "Peito",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Supino Inclinado",
    aliases: ["incline bench", "supino inclinado", "supino incline"],
    muscleGroup: "Peito",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Agachamento",
    aliases: ["squat", "agachamento livre", "back squat"],
    muscleGroup: "Pernas",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Levantamento Terra",
    aliases: ["deadlift", "terra", "levantamento"],
    muscleGroup: "Posterior",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Desenvolvimento",
    aliases: [
      "overhead press",
      "ohp",
      "press militar",
      "desenvolvimento com barra",
    ],
    muscleGroup: "Ombros",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Remada Curvada",
    aliases: ["bent over row", "remada", "remada pronada", "remada supinada"],
    muscleGroup: "Costas",
    equipment: "barra olimpica",
    barWeightKg: 20,
  },
  {
    name: "Rosca Direta",
    aliases: ["curl", "rosca", "barbell curl", "rosca barra"],
    muscleGroup: "Biceps",
    equipment: "barra EZ",
    barWeightKg: 7,
  },
  {
    name: "Triceps Testa",
    aliases: ["skull crusher", "triceps testa", "testa", "french press"],
    muscleGroup: "Triceps",
    equipment: "barra EZ",
    barWeightKg: 7,
  },
  {
    name: "Leg Press",
    aliases: ["leg press", "pressao de perna"],
    muscleGroup: "Pernas",
    equipment: "maquina",
    barWeightKg: null,
  },
  {
    name: "Puxada Frente",
    aliases: ["lat pulldown", "puxada", "puxada pela frente", "puxada frente"],
    muscleGroup: "Costas",
    equipment: "maquina",
    barWeightKg: null,
  },
];

async function main() {
  console.log("Iniciando seed do catalogo de exercicios...");

  for (const exercise of exercises) {
    await prisma.exerciseCatalog.upsert({
      where: { name: exercise.name },
      update: {
        aliases: exercise.aliases,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        barWeightKg: exercise.barWeightKg,
      },
      create: exercise,
    });
    console.log(`  Upsert: ${exercise.name}`);
  }

  console.log(`Seed concluido: ${exercises.length} exercicios processados.`);
}

main()
  .catch((err) => {
    console.error("Erro no seed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
