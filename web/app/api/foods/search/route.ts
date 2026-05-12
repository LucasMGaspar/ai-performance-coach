import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const filePath = path.join(process.cwd(), "data", "taco.json");
    const fileData = fs.readFileSync(filePath, "utf-8");
    const foods = JSON.parse(fileData);

    // Busca simples por descrição
    const results = foods
      .filter((f: any) => f.description.toLowerCase().includes(query))
      .slice(0, 20); // Limitar a 20 resultados para performance

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to search foods" }, { status: 500 });
  }
}
