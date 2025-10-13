// @ts-ignore - nodemailer types may not be available
import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

// Email configuration (to be loaded from environment variables)
const config = {
  GMAIL_SERVICE: process.env.GMAIL_SERVICE?.trim() || 'gmail',
  GMAIL_HOST: process.env.GMAIL_HOST?.trim() || 'smtp.gmail.com',
  GMAIL_PORT: process.env.GMAIL_PORT?.trim() || '465',
  GMAIL_AUTH_USER: process.env.GMAIL_AUTH_USER?.trim() || '',
  GMAIL_AUTH_PASSWORD: process.env.GMAIL_AUTH_PASSWORD?.trim() || '',
};

export class EmailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    // Initialize nodemailer transporter with env variables
    this.transporter = nodemailer.createTransport({
      service: config.GMAIL_SERVICE,
      host: config.GMAIL_HOST,
      port: Number(config.GMAIL_PORT),
      secure: true, // Use SSL for port 465
      auth: {
        user: config.GMAIL_AUTH_USER,
        pass: config.GMAIL_AUTH_PASSWORD,
      },
    });

    // Log configuration (without password) for debugging
    logger.info('Email service initialized', {
      service: config.GMAIL_SERVICE,
      host: config.GMAIL_HOST,
      port: config.GMAIL_PORT,
      user: config.GMAIL_AUTH_USER,
      passwordConfigured: !!config.GMAIL_AUTH_PASSWORD
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string
  ): Promise<void> {
    try {
      logger.info({ email }, 'Sending password reset email');

      const resetUrl = `${process.env.RESET_PASSWORD_URL || 'http://localhost:3000/reset-password'}?token=${resetToken}`;
      const displayName = userName || email.split('@')[0] || 'User';

      const mailOptions = {
        from: `"Asset Management System" <${config.GMAIL_AUTH_USER}>`,
        to: email,
        subject: 'Password Reset Request - Asset Management System',
        html: this.generatePasswordResetEmailTemplate(displayName, resetUrl),
        text: this.generatePasswordResetEmailText(displayName, resetUrl),
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(
        { 
          email, 
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected 
        }, 
        'Password reset email sent successfully'
      );
    } catch (error) {
      logger.error({ error, email }, 'Failed to send password reset email');
      throw new Error('Failed to send password reset email. Please try again later.');
    }
  }

  /**
   * Generate HTML template for password reset email
   */
  private generatePasswordResetEmailTemplate(
    userName: string,
    resetUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Asset Management System</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #007bff;
            margin: 0;
          }
          .content {
            margin-bottom: 30px;
          }
          .reset-button {
            display: inline-block;
            background-color: #007bff;
            color: #ffffff !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
          }
          .reset-button:hover {
            background-color: #0056b3;
          }
          .token-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
          }
          .warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Asset Management System</h1>
            <p>Password Reset Request</p>
          </div>
          
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>We received a request to reset your password for your Asset Management System account. If you made this request, please click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="reset-button">Reset Password</a>
            </div>
            
            <div class="token-info">
              <p><strong>Alternative method:</strong> If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; font-family: monospace; background-color: #e9ecef; padding: 8px; border-radius: 3px;">${resetUrl}</p>
            </div>
            
            <div class="warning">
              <p><strong>Important Security Information:</strong></p>
              <ul>
                <li>This reset link will expire in <strong>15 minutes</strong> for security reasons</li>
                <li>If you didn't request this password reset, please ignore this email and your password will remain unchanged</li>
                <li>For security, never share this link with anyone</li>
              </ul>
            </div>
            
            <p>If you're having trouble with the password reset process, please contact our support team.</p>
            
            <p>Best regards,<br>
            Asset Management System Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text version for password reset email
   */
  private generatePasswordResetEmailText(userName: string, resetUrl: string): string {
    return `
Asset Management System - Password Reset Request

Hello ${userName},

We received a request to reset your password for your Asset Management System account.

To reset your password, please visit the following link:
${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This reset link will expire in 15 minutes for security reasons
- If you didn't request this password reset, please ignore this email
- For security, never share this link with anyone

If you're having trouble with the password reset process, please contact our support team.

Best regards,
Asset Management System Team

---
This is an automated email. Please do not reply to this message.
If you have any questions, please contact our support team.
    `;
  }

  /**
   * Send email verification (for future use)
   */
  async sendEmailVerification(
    email: string,
    verificationToken: string,
    userName?: string
  ): Promise<void> {
    try {
      logger.info({ email }, 'Sending email verification');

      const verifyUrl = `${process.env.VERIFY_EMAIL_URL || 'http://localhost:3000/verify-email'}?token=${verificationToken}`;
      const displayName = userName || email.split('@')[0];

      const mailOptions = {
        from: `"Asset Management System" <${config.GMAIL_AUTH_USER}>`,
        to: email,
        subject: 'Email Verification - Asset Management System',
        html: `
          <h2>Welcome to Asset Management System</h2>
          <p>Hello ${displayName},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        `,
        text: `
Welcome to Asset Management System

Hello ${displayName},

Please verify your email address by visiting: ${verifyUrl}

This link will expire in 24 hours.
If you didn't create an account, please ignore this email.
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(
        { 
          email, 
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected 
        }, 
        'Email verification sent successfully'
      );
    } catch (error) {
      logger.error({ error, email }, 'Failed to send email verification');
      throw new Error('Failed to send email verification. Please try again later.');
    }
  }

  /**
   * Send account deletion confirmation email with user data
   */
  async sendAccountDeletionEmail(
    email: string,
    userName: string,
    userData: {
      orders: any[];
      orderlines: any[];
    }
  ): Promise<void> {
    try {
      logger.info({ email, orderCount: userData.orders.length }, 'Sending account deletion email');

      const mailOptions = {
        from: `"Asset Management System" <${config.GMAIL_AUTH_USER}>`,
        to: email,
        subject: 'Account Deletion Confirmation - Your Data Export',
        html: this.generateAccountDeletionEmailTemplate(userName, userData),
        text: this.generateAccountDeletionEmailText(userName, userData),
        attachments: [
          {
            filename: 'user-orders-data.json',
            content: JSON.stringify(userData.orders, null, 2),
            contentType: 'application/json'
          },
          {
            filename: 'user-orderlines-data.json',
            content: JSON.stringify(userData.orderlines, null, 2),
            contentType: 'application/json'
          }
        ]
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(
        { 
          email, 
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected,
          orderCount: userData.orders.length,
          orderlinesCount: userData.orderlines.length
        }, 
        'Account deletion email sent successfully'
      );
    } catch (error) {
      logger.error({ error, email }, 'Failed to send account deletion email');
      throw new Error('Failed to send account deletion email. Please try again later.');
    }
  }

  /**
   * Generate HTML template for account deletion email
   */
  private generateAccountDeletionEmailTemplate(
    userName: string,
    userData: { orders: any[]; orderlines: any[] }
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deletion Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #dc3545;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #dc3545;
            margin: 0;
          }
          .content {
            margin-bottom: 30px;
          }
          .info-box {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #dc3545;
            margin: 20px 0;
          }
          .data-summary {
            background-color: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #007bff;
            margin: 20px 0;
          }
          .warning {
            background-color: #fff3cd;
            color: #856404;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Asset Management System</h1>
            <p>Account Deletion Confirmation</p>
          </div>
          
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>Your account has been successfully deactivated as per your request.</p>
            
            <div class="info-box">
              <p><strong>Account Status:</strong></p>
              <ul>
                <li>Your account has been marked as inactive</li>
                <li>Your personal data has been preserved for record-keeping purposes</li>
                <li>You will no longer be able to access the system with this account</li>
              </ul>
            </div>
            
            <div class="data-summary">
              <p><strong>Your Data Export:</strong></p>
              <p>We've attached your complete order history to this email:</p>
              <ul>
                <li><strong>Total Orders:</strong> ${userData.orders.length}</li>
                <li><strong>Total Order Lines:</strong> ${userData.orderlines.length}</li>
              </ul>
              <p>Please find the following JSON files attached:</p>
              <ul>
                <li><code>user-orders-data.json</code> - All your orders</li>
                <li><code>user-orderlines-data.json</code> - All your order line items</li>
              </ul>
            </div>
            
            <div class="warning">
              <p><strong>Important Information:</strong></p>
              <ul>
                <li>This action cannot be undone automatically</li>
                <li>To reactivate your account, please contact our support team</li>
                <li>Keep the attached files for your records</li>
              </ul>
            </div>
            
            <p>If you did not request this account deletion, please contact our support team immediately.</p>
            
            <p>Thank you for using our services.</p>
            
            <p>Best regards,<br>
            Asset Management System Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text version for account deletion email
   */
  private generateAccountDeletionEmailText(
    userName: string,
    userData: { orders: any[]; orderlines: any[] }
  ): string {
    return `
Asset Management System - Account Deletion Confirmation

Hello ${userName},

Your account has been successfully deactivated as per your request.

ACCOUNT STATUS:
- Your account has been marked as inactive
- Your personal data has been preserved for record-keeping purposes
- You will no longer be able to access the system with this account

YOUR DATA EXPORT:
We've attached your complete order history to this email:
- Total Orders: ${userData.orders.length}
- Total Order Lines: ${userData.orderlines.length}

Attached files:
- user-orders-data.json - All your orders
- user-orderlines-data.json - All your order line items

IMPORTANT INFORMATION:
- This action cannot be undone automatically
- To reactivate your account, please contact our support team
- Keep the attached files for your records

If you did not request this account deletion, please contact our support team immediately.

Thank you for using our services.

Best regards,
Asset Management System Team

---
This is an automated email. Please do not reply to this message.
If you have any questions, please contact our support team.
    `;
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email connection test successful');
      return true;
    } catch (error) {
      logger.error({ error }, 'Email connection test failed');
      return false;
    }
  }
} 