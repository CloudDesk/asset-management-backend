import { pino, Logger as PinoLogger } from 'pino';
import { env } from './env.js';

// Create logger instance with pretty print for development
const loggerConfig = {
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Add transport only in development to avoid type issues
const developmentConfig = env.NODE_ENV === 'development' ? {
  ...loggerConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      messageFormat: '{levelLabel} - {msg}',
    },
  },
} : loggerConfig;

export const logger: PinoLogger = pino(developmentConfig);

export type Logger = PinoLogger; 