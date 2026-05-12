import { FatSecretService } from "@/lib/fatsecret";

const fatSecret = new FatSecretService();

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

    // 1. Busca Local (TACO)
    const localResults = foods
      .filter((f: any) => f.description.toLowerCase().includes(query))
      .slice(0, 10);

    // 2. Busca Externa (FatSecret) se necessário ou como complemento
    let externalResults: any[] = [];
    if (process.env.FATSECRET_CLIENT_ID) {
      const fsResults = await fatSecret.searchFoods(query);
      externalResults = fsResults.map(f => {
        // Tentar extrair macros da string de descrição: 
        // "Per 100g - Calories: 123kcal | Fat: 5.00g | Carbs: 10.00g | Protein: 8.00g"
        const desc = f.rawDescription || "";
        const kcal = desc.match(/Calories: (\d+)kcal/)?.[1];
        const prot = desc.match(/Protein: ([\d.]+)g/)?.[1];
        const carbs = desc.match(/Carbs: ([\d.]+)g/)?.[1];
        const fat = desc.match(/Fat: ([\d.]+)g/)?.[1];

        return {
          id: f.id,
          description: f.brand ? `${f.description} (${f.brand})` : f.description,
          category: "Base Global",
          energy_kcal: Number(kcal || 0),
          protein_g: Number(prot || 0),
          carbohydrate_g: Number(carbs || 0),
          lipid_g: Number(fat || 0),
          isExternal: true
        };
      });
    }

    // Unificar resultados priorizando local
    const combined = [...localResults, ...externalResults].slice(0, 20);

    return NextResponse.json(combined);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Failed to search foods" }, { status: 500 });
  }
}
