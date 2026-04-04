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
    cookieSecure: (process.env.NODE_ENV === 'production').valueOf(),
  },
  chat: {
    internalKey: (process.env.CHAT_INTERNAL_KEY || '').trim(),
  },
});
