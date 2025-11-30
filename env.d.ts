declare global {
    interface CloudflareEnv {
        DB: D1Database;
        AI: Ai;
        VECTORIZE: Vectorize;
        ADMIN_USERNAME: string;
        ADMIN_PASSWORD: string;
    }
}

export {};
