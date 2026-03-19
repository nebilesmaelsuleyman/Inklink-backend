export default () => ({
    database: {
        uri: (process.env.MONGODB_URI || process.env.DB_URL || process.env.DB_URI || '').trim(),
        dbName: (process.env.DB_NAME || process.env.dbName || 'InkLink').trim()
    },
    port: Number.parseInt((process.env.PORT || '4000').trim(), 10) || 4000,
});
