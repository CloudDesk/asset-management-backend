import { createClient, RedisClientType } from 'redis';
import { logger } from './logger.js';

class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<void> {
    if (this.client?.isReady) {
      this.isConnected = true;
      logger.info('Redis already connected');
      return;
    }

    try {
      // Redis connection configuration
      // Supports both local Redis and Redis Cloud
      const redisUrl = process.env.REDIS_URL;
      const redisHost = process.env.REDIS_HOST;
      const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
      const redisPassword = process.env.REDIS_PASSWORD;
      const redisUsername = process.env.REDIS_USERNAME || 'default';

      let clientConfig: any;

      if (redisUrl) {
        // Use connection URL (supports redis://, rediss:// for TLS)
        clientConfig = {
          url: redisUrl,
          socket: {
            reconnectStrategy: (retries: number) => {
              if (retries > 10) {
                logger.error('Redis max reconnection attempts reached');
                return new Error('Max reconnection attempts reached');
              }
              const delay = Math.min(retries * 50, 3000);
              logger.info(`Reconnecting to Redis in ${delay}ms...`);
              return delay;
            }
          }
        };
      } else if (redisHost) {
        // Use individual connection parameters (for Redis Cloud)
        clientConfig = {
          socket: {
            host: redisHost,
            port: redisPort,
            reconnectStrategy: (retries: number) => {
              if (retries > 10) {
                logger.error('Redis max reconnection attempts reached');
                return new Error('Max reconnection attempts reached');
              }
              const delay = Math.min(retries * 50, 3000);
              logger.info(`Reconnecting to Redis in ${delay}ms...`);
              return delay;
            }
          }
        };

        // Add authentication if password is provided
        if (redisPassword) {
          clientConfig.username = redisUsername;
          clientConfig.password = redisPassword;
        }
      } else {
        // Default to local Redis
        clientConfig = {
          url: 'redis://localhost:6379',
          socket: {
            reconnectStrategy: (retries: number) => {
              if (retries > 10) {
                logger.error('Redis max reconnection attempts reached');
                return new Error('Max reconnection attempts reached');
              }
              const delay = Math.min(retries * 50, 3000);
              logger.info(`Reconnecting to Redis in ${delay}ms...`);
              return delay;
            }
          }
        };
      }

      logger.info({ 
        host: redisHost || 'localhost', 
        port: redisPort,
        hasPassword: !!redisPassword,
        usingUrl: !!redisUrl
      }, 'Connecting to Redis...');
      
      this.client = createClient(clientConfig);

      // Error handling
      this.client.on('error', (err) => {
        logger.error({ error: err.message }, 'Redis Client Error');
      });

      this.client.on('connect', () => {
        logger.info('Redis client is connecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis client is ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis client is reconnecting...');
      });

      this.client.on('end', () => {
        logger.info('Redis client connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('✅ Redis connected successfully');
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Get Redis client instance
   */
  public getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isReady(): boolean {
    return this.isConnected && this.client?.isReady === true;
  }

  /**
   * Ensure a usable connection after transient network or Redis Cloud outages.
   * A client that exhausted its reconnect attempts must be replaced.
   */
  public async ensureConnected(): Promise<void> {
    if (this.client?.isReady) {
      this.isConnected = true;
      return;
    }

    if (this.client) {
      try {
        if (this.client.isOpen) {
          await this.client.disconnect();
        }
      } catch (error: any) {
        logger.warn({ error: error.message }, 'Failed to close stale Redis client');
      }
      this.client = null;
      this.isConnected = false;
    }

    await this.connect();
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Ping Redis to check connection
   */
  public async ping(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Redis ping failed');
      return false;
    }
  }

  /**
   * Get Redis info
   */
  public async getInfo(): Promise<any> {
    try {
      if (!this.client || !this.isConnected) {
        return null;
      }
      const info = await this.client.info();
      return info;
    } catch (error) {
      logger.error({ error }, 'Failed to get Redis info');
      return null;
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();

// Export type for use in other files
export type { RedisClientType };

