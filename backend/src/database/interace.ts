export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: MongoConnectionOptions;  }


export interface MongoConnectionOptions {
  useNewUrlParser: boolean;
  useUnifiedTopology: boolean;
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  family: number;
}