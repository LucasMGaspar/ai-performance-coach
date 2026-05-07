import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phoneNumber, weightKg, height, age, targetCalories, targetProtein } = body;

    if (!name || !phoneNumber || !weightKg || !height || !age) {
      return NextResponse.json({ error: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { phoneNumber },
      update: { name, weightKg, height, age, targetCalories, targetProtein },
      create: { name, phoneNumber, weightKg, height, age, targetCalories, targetProtein },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
