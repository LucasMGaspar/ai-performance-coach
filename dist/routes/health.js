const healthRoute = async (fastify) => {
    fastify.get("/health", async (_request, _reply) => {
        return { status: "ok", timestamp: new Date().toISOString() };
    });
};
export default healthRoute;
//# sourceMappingURL=health.js.map