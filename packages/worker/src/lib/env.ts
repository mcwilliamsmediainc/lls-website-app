import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  workerId: optional("WORKER_ID", "worker-1"),

  redisUrl: required("REDIS_URL"),

  apiBaseUrl: optional("API_BASE_URL", "http://localhost:3000"),
  workerToken: required("WORKER_API_TOKEN"),

  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  anthropicModel: optional("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
  anthropicMaxTokens: Number(optional("ANTHROPIC_MAX_TOKENS", "1000")),
  anthropicMaxTokensPage: Number(optional("ANTHROPIC_MAX_TOKENS_PAGE", "8000")),
  /** Ordered Sonnet fallbacks if the primary model is unavailable. */
  anthropicFallbackModels: optional(
    "ANTHROPIC_FALLBACK_MODELS",
    "claude-sonnet-4-5,claude-3-5-sonnet-latest"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  geminiApiKey: optional("GEMINI_API_KEY", ""),
  geminiModel: optional("GEMINI_MODEL", "gemini-2.5-flash"),

  googleDriveKbFolderId: optional("GOOGLE_DRIVE_KB_FOLDER_ID", ""),
  googleDriveOauthToken: optional("GOOGLE_DRIVE_OAUTH_TOKEN", ""),
  googleDriveMcpUrl: optional("GOOGLE_DRIVE_MCP_URL", "https://drivemcp.googleapis.com/mcp/v1"),

  concurrentBuilds: Number(optional("CONCURRENT_BUILDS", "3")),
  heartbeatIntervalMs: Number(optional("HEARTBEAT_INTERVAL_MS", "60000")),
  kbCacheRefreshMs: Number(optional("KB_CACHE_REFRESH_MS", "3600000")),
};
