declare class OnboardingAgent {
    handle(userId: string, phone: string, text: string): Promise<string>;
    private handleWelcome;
    private handleProfile;
    private handleExperienceGoal;
    private handleCaloriesConfirm;
    private handleMeals;
    private handleMealsConfirm;
}
export declare const onboardingAgent: OnboardingAgent;
export {};
//# sourceMappingURL=onboarding.agent.d.ts.map