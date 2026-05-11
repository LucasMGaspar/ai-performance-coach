import { OnboardingForm } from "./OnboardingForm";
import { Dumbbell } from "lucide-react";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-cyan-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="p-5 pb-16 max-w-lg mx-auto space-y-6">
        <div className="pt-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500/10 rounded-2xl mb-4">
            <Dumbbell className="text-orange-500 w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Configurar Perfil</h1>
          <p className="text-slate-500 text-sm mt-2">
            Preencha os seus dados para personalizar o protocolo de 80 dias.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
