const parseBool = (value: string | undefined, fallback: boolean) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export default () => ({
  database: {
    uri: (
      process.env.MONGODB_URI ||
      process.env.DB_URL ||
      process.env.DB_URI ||
      ''
    ).trim(),
    dbName: (process.env.DB_NAME || process.env.dbName || 'InkLink').trim(),
  },
  port: Number.parseInt((process.env.PORT || '4000').trim(), 10) || 4000,
  auth: {
    jwtSecret: (process.env.JWT_SECRET || 'change-me-in-env').trim(),
    jwtExpiresInSeconds:
      Number.parseInt((process.env.JWT_EXPIRES_IN_SECONDS || '604800').trim(), 10) ||
      604800,
    cookieName: (process.env.AUTH_COOKIE_NAME || 'auth_token').trim(),
    cookieSecure: parseBool(
      process.env.AUTH_COOKIE_SECURE,
      process.env.NODE_ENV === 'production',
    ),
    cookieSameSite: (
      process.env.AUTH_COOKIE_SAME_SITE ||
      (process.env.NODE_ENV === 'production' ? 'none' : 'lax')
    )
      .trim()
      .toLowerCase(),
    cookieDomain: (process.env.AUTH_COOKIE_DOMAIN || '').trim(),
  },
  chat: {
    internalKey: (process.env.CHAT_INTERNAL_KEY || '').trim(),
  },
  moderation: {
    baseUrl: (process.env.MODERATION_BASE_URL || 'http://localhost:8000').trim(),
    requestTimeoutMs:
      Number.parseInt((process.env.MODERATION_REQUEST_TIMEOUT_MS || '6000').trim(), 10) ||
      6000,
    safeConfidenceThreshold:
      Number.parseFloat((process.env.MODERATION_SAFE_CONFIDENCE_THRESHOLD || '0.88').trim()) ||
      0.88,
    unsafeConfidenceThreshold:
      Number.parseFloat((process.env.MODERATION_UNSAFE_CONFIDENCE_THRESHOLD || '0.88').trim()) ||
      0.88,
  },
});
