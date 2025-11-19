import mysql from "mysql2/promise";

interface DBConfig {
  host: string;
  user: string;
  password: string;
  database: string;
}

const config: DBConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "real_skills",
};

let pool: mysql.Pool | null = null;

export const getPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
};

export const query = async (
  sql: string,
  params?: unknown[],
): Promise<unknown[]> => {
  const connection = await getPool();
  const [results] = await connection.execute(sql, params || []);
  return results as unknown[];
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await getPool();
    await connection.execute("SELECT 1 as test");
    return true;
  } catch (error) {
    throw error;
  }
};

