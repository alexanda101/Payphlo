export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }
  return secret;
}

export function getAllowedOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:3000,http://127.0.0.1:3000";

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateStartupEnv() {
  getJwtSecret();
}
