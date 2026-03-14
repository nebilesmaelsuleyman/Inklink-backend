export default () => ({
    database: {
        uri: process.env.DB_URL || 'mongodb+srv://InkLink:InkLink@cluster0.ramuxrb.mongodb.net/InkLink?appName=Cluster0',
        dbName: process.env.DB_NAME || 'InkLink'
    },
    port: process.env.PORT || 4000,
});