import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import  * as mongoose from 'mongoose';
import type { DatabaseConfig, MongoConnectionOptions } from './interace';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit , OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private connection: mongoose.Connection;
  private config: DatabaseConfig;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<DatabaseConfig>('database');
    if (!config) {
      throw new Error('Database configuration is not defined');
    }
    this.config = config;
  }
    async onModuleInit() {
        try {
            const options: mongoose.ConnectOptions = (this.config.options as mongoose.ConnectOptions) || {};
            const conn = await mongoose.createConnection(this.config.uri, options).asPromise();
            this.connection = conn;
            this.logger.log('Database connection established');
        } catch (error) {
            this.logger.error('Failed to connect to database', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        if (this.connection) {
            await this.connection.close();
            this.logger.log('Database connection closed');
        }
    }

    // getConnection(): mongoose.Connection {
    //     if (!this.connection) {
    //         throw new Error('Database connection has not been established yet.');
    //     }
    //     return this.connection;
    // }

    private async connect() {
    const dbConfig = this.configService.get<DatabaseConfig>('database');
    
    const options: MongoConnectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };
        try {
      mongoose.set('strictQuery', true);
      
      await mongoose.connect(this.config.uri, {
        ...options,
        dbName: this.config.dbName,
      });

      this.connection = mongoose.connection;

      this.connection.on('connected', () => {
        this.logger.log('MongoDB connected successfully');
      });

      this.connection.on('error', (error) => {
        this.logger.error(`MongoDB connection error: ${error}`);
      });
      this.connection.on('disconnected', () => {
        this.logger.warn('MongoDB disconnected');
      });

      // Handle application termination
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${error.message}`);
      throw error;
    }
  }

 private async disconnect() {
    try {
      await mongoose.disconnect();
      this.logger.log('MongoDB disconnected successfully');
    } catch (error) {
      this.logger.error(`Error disconnecting from MongoDB: ${error.message}`);
    }
  }

  getConnection(): mongoose.Connection {
    return this.connection;
  }

  async checkHealth(): Promise<boolean> {
    return mongoose.connection.readyState === 1;
  }
}