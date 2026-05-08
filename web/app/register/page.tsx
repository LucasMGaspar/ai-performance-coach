"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      phoneNumber: (form.get("phoneNumber") as string).replace(/\D/g, ""),
      weightKg: parseFloat(form.get("weightKg") as string),
      height: parseFloat(form.get("height") as string),
      age: parseInt(form.get("age") as string, 10),
      targetCalories: form.get("targetCalories")
        ? parseFloat(form.get("targetCalories") as string)
        : null,
      targetProtein: form.get("targetProtein")
        ? parseFloat(form.get("targetProtein") as string)
        : null,
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao registar. Tenta novamente.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Erro de conexão. Verifica a tua internet.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registro completo!</h2>
          <p className="text-gray-600 mb-6">
            O seu perfil foi criado. Já pode usar o AI Performance Coach no WhatsApp.
          </p>
          <a
            href="/admin"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Ver Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI Performance Coach</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Preencha seus dados para começar o protocolo de 80 dias.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo *
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="Lucas Silva"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número WhatsApp * <span className="text-gray-400 font-normal">(com código do país)</span>
              </label>
              <input
                name="phoneNumber"
                type="tel"
                required
                placeholder="5527999134491"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg) *</label>
              <input
                name="weightKg"
                type="number"
                step="0.1"
                required
                placeholder="80"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm) *</label>
              <input
                name="height"
                type="number"
                required
                placeholder="178"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Idade *</label>
              <input
                name="age"
                type="number"
                required
                placeholder="25"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta calorias
              </label>
              <input
                name="targetCalories"
                type="number"
                placeholder="2400"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta proteína (g)
              </label>
              <input
                name="targetProtein"
                type="number"
                placeholder="160"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "A registar..." : "Criar perfil"}
          </button>
        </form>
      </div>
    </div>
  );
}
