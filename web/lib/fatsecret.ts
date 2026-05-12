import axios from "axios";

export class FatSecretService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.FATSECRET_CLIENT_ID || "";
    this.clientSecret = process.env.FATSECRET_CLIENT_SECRET || "";
  }

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    
    try {
      const response = await axios.post(
        "https://oauth.fatsecret.com/connect/token",
        "grant_type=client_credentials&scope=basic",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error("FatSecret Auth Error:", error);
      return null;
    }
  }

  async searchFoods(query: string) {
    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const response = await axios.get("https://platform.fatsecret.com/rest/server.api", {
        params: {
          method: "foods.search",
          search_expression: query,
          format: "json",
          max_results: 10,
          region: "BR", // Focar em produtos brasileiros
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const foods = response.data.foods?.food || [];
      // Se vier apenas um objeto, transforma em array
      const foodList = Array.isArray(foods) ? foods : [foods];

      // Mapear para o nosso formato simplificado
      // Nota: O search básico do FatSecret não traz os macros detalhados (precisa do food.get)
      // Mas traz uma string "food_description" que podemos tentar parsear ou deixar para o detalhe
      return foodList.map((f: any) => ({
        id: `fs_${f.food_id}`,
        description: f.food_name,
        category: f.food_type,
        brand: f.brand_name,
        rawDescription: f.food_description // "Per 100g - Calories: 123kcal | Fat: 5g | Carbs: 10g | Protein: 8g"
      }));
    } catch (error) {
      console.error("FatSecret Search Error:", error);
      return [];
    }
  }

  async getFoodDetails(foodId: string) {
    const token = await this.getAccessToken();
    if (!token) return null;

    const cleanId = foodId.replace("fs_", "");

    try {
      const response = await axios.get("https://platform.fatsecret.com/rest/server.api", {
        params: {
          method: "food.get.v2",
          food_id: cleanId,
          format: "json",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const food = response.data.food;
      const servings = food.servings.serving;
      // Pegar a primeira porção ou a de 100g se disponível
      const serving = Array.isArray(servings) 
        ? servings.find((s: any) => s.metric_serving_amount === "100.000") || servings[0]
        : servings;

      return {
        id: `fs_${food.food_id}`,
        description: food.food_name,
        energy_kcal: Number(serving.calories),
        protein_g: Number(serving.protein),
        carbohydrate_g: Number(serving.carbohydrate),
        lipid_g: Number(serving.fat),
        serving_description: serving.serving_description,
        metric_serving_amount: serving.metric_serving_amount,
        metric_serving_unit: serving.metric_serving_unit
      };
    } catch (error) {
      console.error("FatSecret Detail Error:", error);
      return null;
    }
  }
}
