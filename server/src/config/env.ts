// Helper to get env var with proper trimming
const getEnv = (key: string, defaultValue: string = ""): string => {
  const value = process.env[key];
  return value ? value.trim() : defaultValue;
};

export const config = {
  port: Number(process.env.PORT) || 3001,
  db: {
    host: getEnv("DB_HOST", "localhost"),
    user: getEnv("DB_USER", "root"),
    password: getEnv("DB_PASSWORD", ""),
    database: getEnv("DB_NAME", "real_skills"),
  },
  nodeEnv: getEnv("NODE_ENV", "development"),
  clientUrl: getEnv("CLIENT_URL", "http://localhost:5173"),
  mercadoPago: {
    // Use getter function to read at runtime, not at module load time
    get accessToken(): string {
      return getEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    },
  },
};

