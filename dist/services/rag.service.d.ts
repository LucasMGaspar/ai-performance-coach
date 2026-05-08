interface WorkoutLog {
    id: string;
    userId: string;
    exerciseId: string;
    date: Date;
    weightKg: number;
    reps: number;
    sets: number;
    rpe: number | null;
    volume: number;
    rawInput: string | null;
}
interface DietSummaryToday {
    calories: number;
    protein: number;
    mealsLogged: string[];
}
declare class RagService {
    /**
     * Busca os últimos 3 WorkoutLog do utilizador para um exercício específico.
     * Ordenado por date DESC, limit 3.
     */
    getLast3Workouts(userId: string, exerciseId: string): Promise<WorkoutLog[]>;
    /**
     * Busca todos os DietLog do utilizador de hoje.
     * Soma calories e protein; retorna lista de meal names registados hoje.
     */
    getDietSummaryToday(userId: string): Promise<DietSummaryToday>;
    /**
     * Verifica se existe pelo menos 1 WorkoutLog do utilizador hoje.
     */
    hasWorkoutToday(userId: string): Promise<boolean>;
    /**
     * Verifica se existe DailyCheckIn do utilizador hoje.
     */
    hasCheckInToday(userId: string): Promise<boolean>;
}
export declare const ragService: RagService;
export {};
//# sourceMappingURL=rag.service.d.ts.map