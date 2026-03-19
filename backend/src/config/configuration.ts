export default () => ({
    database: {
        uri: process.env.MONGODB_URI || 'mongodb+srv://InkLink:InkLink@cluster0.ramuxrb.mongodb.net/InkLink?appName=Cluster0',
        dbName: process.env.dbName || 'InkLink'
    },
    port: process.env.PORT || 4000,
});