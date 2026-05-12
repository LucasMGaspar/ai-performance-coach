import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { userId, meal, calories, protein, carbs, fat } = await request.json();

    const log = await prisma.dietLog.create({
      data: {
        userId,
        meal,
        calories,
        protein,
        carbs,
        fat,
        date: new Date(),
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error("Save diet log error:", error);
    return NextResponse.json({ error: "Failed to save diet log" }, { status: 500 });
  }
}
