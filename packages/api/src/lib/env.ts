/**
 * Centralized, validated environment access for the API.
 * Loads .env once and exposes typed getters. Fails fast on missing required vars.
 */

import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "3000")),
  appUrl: optional("APP_URL", "http://localhost:3000"),
  devUrl: optional("DEV_URL", ""),
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  onboardingBaseUrl: optional("ONBOARDING_BASE_URL", "http://localhost:5173"),

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),

  authSecret: required("AUTH_SECRET"),
  totpIssuer: optional("TOTP_ISSUER", "LLS Build Workspace"),
  /** When true, accounts without a provisioned TOTP secret cannot obtain a
   * fully authenticated session. Off for internal testing, on before launch. */
  mfaRequired: optional("MFA_REQUIRED", "false") === "true",
  /** Shared secret the worker presents on internal callback routes. */
  workerToken: optional("WORKER_API_TOKEN", ""),
  /** Bearer token an external monitoring service presents to GET /api/status.
   * Distinct from the worker token and user sessions; if empty the endpoint 503s. */
  statusToken: optional("STATUS_API_TOKEN", ""),

  spaces: {
    key: optional("DO_SPACES_KEY"),
    secret: optional("DO_SPACES_SECRET"),
    bucket: optional("DO_SPACES_BUCKET"),
    region: optional("DO_SPACES_REGION", "nyc3"),
    endpoint: optional("DO_SPACES_ENDPOINT", "https://nyc3.digitaloceanspaces.com"),
    // DO Spaces uses virtual-hosted style (false). MinIO and other local S3s
    // need path-style addressing (true).
    forcePathStyle: optional("DO_SPACES_FORCE_PATH_STYLE", "false") === "true",
  },

  alertEmail: optional("ALERT_EMAIL", "matt@mcwilliamsmedia.com"),

  isProd(): boolean {
    return this.nodeEnv === "production";
  },
};
