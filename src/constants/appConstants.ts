import dotenv from 'dotenv';
dotenv.config();

export const aws = {
  ACCESSKEYID: process.env.ACCESSKEYID || '',
  SECRETACCESSKEY: process.env.SECRETACCESSKEY || '',
  REGION: process.env.REGION || '',
};

export const database = {
  USER: process.env.POSTGRES_USER || '',
  PASSWORD: process.env.POSTGRES_PASSWORD || '',
  HOST: process.env.POSTGRES_HOST || '',
  PORT: process.env.POSTGRES_PORT || '',
  DATABASE: process.env.POSTGRES__DATABASE || '',
};

export const email = {
  SERVICE: process.env.GMAIL_SERVICE || '',
  HOST: process.env.GMAIL_HOST || '',
  PORT: process.env.GMAIL_PORT || '',
  AUTH_USER: process.env.GMAIL_AUTH_USER || '',
  AUTH_PASSWORD: process.env.GMAIL_AUTH_PASSWORD || '',
};

export const gcp = {
  TASK_URL: process.env.GCP_TASK_URL || '',
  PROJECT_ID: process.env.GCP_PROJECT_ID || '',
  PROJECT_QUEUE: process.env.GCP_PROJECT_QUEUE || '',
  PROJECT_LOCATION: process.env.GCP_PROJECT_LOCATION || '',
};

export const app = {
  PORT: process.env.PORT || '3000',
  PROTOCOL: process.env.PROTOCOL || 'http',
  REDIRECT_URL_PAYMENT_STATUS: process.env.REDIRECT_URL_PAYMENT_STATUS || '',
  REDIRECT_URL_SUCCESS: process.env.REDIRECT_URL_SUCCESS || '',
  REDIRECT_URL_FAILURE: process.env.REDIRECT_URL_FAILURE || '',
  REDIRECT_INVENTORY_URL: process.env.REDIRECT_INVENTORY_URL || '',
};