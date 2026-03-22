import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';

// Define the interfaces directly in the same file
export interface MongoConnectionOptions {
  maxPoolSize?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  family?: number;
  dbName?: string;
}

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: MongoConnectionOptions;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private connection: mongoose.Connection;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const config = this.configService.get<DatabaseConfig>('database');
    if (!config || !config.uri) {
      throw new Error('Database configuration or URI is missing');
    }

    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      dbName: config.dbName,
      ...config.options,
    };

    try {
      // Establish the connection and store the reference
      const conn = await mongoose.connect(config.uri, options);
      this.connection = conn.connection;

      this.logger.log(`MongoDB Atlas connection established: ${config.dbName}`);

      this.connection.on('error', (err) =>
        this.logger.error(`MongoDB Error: ${err}`),
      );
      this.connection.on('disconnected', () =>
        this.logger.warn('MongoDB disconnected'),
      );
    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
      this.logger.log('MongoDB connection closed gracefully');
    }
  }

  getConnection(): mongoose.Connection {
    return this.connection;
  }

  async checkHealth(): Promise<boolean> {
    return this.connection?.readyState === 1;
  }
}
