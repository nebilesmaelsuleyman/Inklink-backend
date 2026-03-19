export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: MongoConnectionOptions;
}

export interface MongoConnectionOptions {
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  family: number;
}
