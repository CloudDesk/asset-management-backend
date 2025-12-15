import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Storage Service - HTTP Client for GCP Storage Backend
 * This service makes HTTP calls to a separate storage backend service
 * Used for storing: product images, invoices, shipping labels, and other files
 */
export class StorageService {
  private apiClient: AxiosInstance;
  private apiBaseUrl: string;
  private apiKey: string;

  constructor() {
    // Storage backend API URL (separate service)
    this.apiBaseUrl = process.env.STORAGE_API_URL || 'http://localhost:3001/api/v1';
    this.apiKey = process.env.STORAGE_API_KEY || '';

    this.apiClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request interceptor for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'Storage API request');
        return config;
      },
      (error) => {
        logger.error({ error: error.message }, 'Storage API request error');
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(
          {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
          },
          'Storage API response error'
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Upload file buffer to Storage Backend
   * @param fileBuffer - File buffer to upload
   * @param fileName - File name/path in bucket
   * @param bucketName - Target bucket name
   * @param contentType - MIME type
   * @param makePublic - Make file publicly accessible (default: true)
   * @returns Public URL of uploaded file
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    bucketName?: string,
    contentType: string = 'application/pdf',
    makePublic: boolean = true
  ): Promise<string> {
    try {
      logger.info(
        { fileName, contentType, fileSize: fileBuffer.length, bucketName },
        'Uploading file to Storage Backend'
      );

      const response = await this.apiClient.post('/storage/upload-buffer', {
        fileBuffer: fileBuffer.toString('base64'),
        fileName,
        bucket: bucketName,
        contentType,
        makePublic
      });

      if (response.data.success && response.data.data?.url) {
        logger.info(
          { fileName, url: response.data.data.url },
          'File uploaded to Storage Backend successfully'
        );
        return response.data.data.url;
      }

      throw new Error('Invalid response from storage backend');
    } catch (error: any) {
      logger.error(
        { error: error.message, fileName, bucketName },
        'Failed to upload file to Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Upload file to a specific bucket
   * @param fileBuffer - File buffer to upload
   * @param fileName - File name/path in bucket
   * @param contentType - MIME type
   * @param targetBucketName - Target bucket name
   * @returns Public URL of uploaded file
   */
  async uploadFileToBucket(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/pdf',
    targetBucketName?: string
  ): Promise<string> {
    return this.uploadFile(fileBuffer, fileName, targetBucketName, contentType, true);
  }

  /**
   * Upload shipping label PDF to Storage Backend
   * EKART API returns binary PDF (application/octet-stream) which is converted to Buffer
   * Uses dedicated shipping bucket: SHIPPING_BUCKET or default 'niv-shipping-lavel-dev'
   * Storage path: tracking_id/label.pdf (e.g., FMPC001/label.pdf)
   * @param pdfBuffer - PDF buffer from EKART API (binary response converted to Buffer)
   * @param trackingId - Tracking ID (used as folder name)
   * @returns Public URL of uploaded label
   */
  async uploadShippingLabel(pdfBuffer: Buffer, trackingId: string): Promise<string> {
    try {
      logger.info(
        { trackingId, fileSize: pdfBuffer.length },
        'Uploading shipping label to Storage Backend'
      );

      // Path format: tracking_id/label.pdf (e.g., FMPC001/label.pdf)
      const fileName = `${trackingId}/label.pdf`;
      const shippingBucket = process.env.SHIPPING_BUCKET || 'niv-shipping-lavel-dev';

      // Use upload-buffer endpoint with shipping bucket
      const response = await this.apiClient.post('/storage/upload-buffer', {
        fileBuffer: pdfBuffer.toString('base64'),
        fileName,
        bucket: shippingBucket,
        contentType: 'application/pdf',
        makePublic: true
      });

      if (response.data.success && response.data.data?.url) {
        logger.info(
          { trackingId, url: response.data.data.url },
          'Shipping label uploaded to Storage Backend successfully'
        );
        return response.data.data.url;
      }

      throw new Error('Invalid response from storage backend');
    } catch (error: any) {
      logger.error(
        { error: error.message, trackingId },
        'Failed to upload shipping label to Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Upload product image to Storage Backend
   * @param imageBuffer - Image buffer
   * @param productId - Product ID
   * @param size - Image size ('large', 'medium', 'small')
   * @param index - Image index (for multiple images)
   * @param extension - File extension (e.g., 'jpg', 'png')
   * @returns Public URL of uploaded image
   */
  async uploadProductImage(
    imageBuffer: Buffer,
    productId: string | number,
    size: 'large' | 'medium' | 'small',
    index: number = 0,
    extension: string = 'jpg'
  ): Promise<string> {
    try {
      const fileName = `products/${productId}/${size}/${index}.${extension}`;
      const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const bucket = process.env.PRODUCTS_BUCKET || process.env.GCP_STORAGE_BUCKET || 'nivaana-storage';

      return this.uploadFile(imageBuffer, fileName, bucket, contentType);
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, size },
        'Failed to upload product image to Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Upload invoice PDF to Storage Backend
   * @param pdfBuffer - PDF buffer
   * @param invoiceId - Invoice ID or invoice number
   * @param type - Invoice type (e.g., 'po', 'sales', 'purchase')
   * @returns Public URL of uploaded invoice
   */
  async uploadInvoice(
    pdfBuffer: Buffer,
    invoiceId: string | number,
    type: string = 'invoice'
  ): Promise<string> {
    try {
      const fileName = `invoices/${type}/${invoiceId}.pdf`;
      const bucket = process.env.INVOICES_BUCKET || process.env.GCP_STORAGE_BUCKET || 'nivaana-storage';

      return this.uploadFile(pdfBuffer, fileName, bucket, 'application/pdf');
    } catch (error: any) {
      logger.error(
        { error: error.message, invoiceId, type },
        'Failed to upload invoice to Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Upload generic document to Storage Backend
   * @param fileBuffer - File buffer
   * @param category - Document category (e.g., 'documents', 'exports', 'reports')
   * @param fileName - File name
   * @param contentType - MIME type
   * @returns Public URL of uploaded file
   */
  async uploadDocument(
    fileBuffer: Buffer,
    category: string,
    fileName: string,
    contentType: string = 'application/pdf'
  ): Promise<string> {
    try {
      const filePath = `${category}/${fileName}`;
      const bucket = process.env.GCP_STORAGE_BUCKET || 'nivaana-storage';

      return this.uploadFile(fileBuffer, filePath, bucket, contentType);
    } catch (error: any) {
      logger.error(
        { error: error.message, category, fileName },
        'Failed to upload document to Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Delete file from Storage Backend
   * @param fileName - File name/path in bucket
   * @param bucketName - Bucket name (optional)
   */
  async deleteFile(fileName: string, bucketName?: string): Promise<void> {
    try {
      logger.info({ fileName, bucketName }, 'Deleting file from Storage Backend');

      await this.apiClient.delete('/storage/files', {
        data: {
          fileName,
          bucket: bucketName
        }
      });

      logger.info({ fileName, bucketName }, 'File deleted from Storage Backend successfully');
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn({ fileName, bucketName }, 'File not found in Storage Backend (already deleted?)');
        return;
      }
      logger.error(
        { error: error.message, fileName, bucketName },
        'Failed to delete file from Storage Backend'
      );
      throw error;
    }
  }

  /**
   * Check if file exists in Storage Backend
   * @param fileName - File name/path in bucket
   * @param bucketName - Bucket name (optional)
   * @returns True if file exists
   */
  async fileExists(fileName: string, bucketName?: string): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/storage/files/exists', {
        params: {
          fileName,
          bucket: bucketName
        }
      });

      return response.data.success && response.data.data?.exists === true;
    } catch (error: any) {
      logger.error(
        { error: error.message, fileName, bucketName },
        'Error checking file existence in Storage Backend'
      );
      return false;
    }
  }

  /**
   * Get public URL for a file (without uploading)
   * Useful for generating URLs or checking if file exists
   * @param fileName - File name/path in bucket
   * @param bucketName - Bucket name (optional)
   * @returns Public URL
   */
  getPublicUrl(fileName: string, bucketName?: string): string {
    const bucket = bucketName || process.env.GCP_STORAGE_BUCKET || 'nivaana-storage';
    return `https://storage.googleapis.com/${bucket}/${fileName}`;
  }
}

// Export singleton instance
export const storageService = new StorageService();
