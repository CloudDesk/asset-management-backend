import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { EmailService } from './email.service.js';

export type CustomerEmailResult =
  | { sent: true; email: string }
  | { sent: false; reason: 'missing_customer' | 'missing_email' | 'send_failed' };

export type OrderEmailKind =
  | 'order_confirmation'
  | 'payment_confirmation'
  | 'shipment_update'
  | 'delivery_confirmation'
  | 'order_cancellation'
  | 'refund_notification';

export type OrderEmailDetails = {
  status?: string;
  reason?: string;
  refundAmount?: number;
  refundReference?: string;
  location?: string;
  description?: string;
};

export type PromotionEmailInput = {
  customerIds: number[];
  promotionName: string;
  voucherCode?: string | null;
  description?: string | null;
  startDate?: bigint | number | string | null;
  endDate?: bigint | number | string | null;
  usageLimit?: number | null;
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const titleCaseStatus = (value?: string) =>
  String(value || 'updated').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatMoney = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));

const formatDate = (value?: bigint | number | string | null) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  const millis = Number.isFinite(numeric) && numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const date = Number.isFinite(millis) ? new Date(millis) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

export class CustomerEmailNotificationService {
  constructor(
    private readonly emailService: Pick<EmailService, 'sendTransactionalEmail'> = new EmailService(),
    private readonly database: typeof prisma = prisma,
  ) {}

  private runInBackground(
    operation: string,
    context: Record<string, unknown>,
    task: () => Promise<unknown>,
  ): void {
    setImmediate(() => {
      void Promise.resolve().then(task).catch((error) => {
        logger.error({ error, ...context }, `${operation} failed in the background`);
      });
    });
  }

  queueOrderEmail(orderId: number, kind: OrderEmailKind, details: OrderEmailDetails = {}): void {
    this.runInBackground('Customer order email', { orderId, kind }, () =>
      this.sendOrderEmail(orderId, kind, details));
  }

  queuePromotionVoucher(input: PromotionEmailInput): void {
    this.runInBackground(
      'Customer promotion email',
      { customerCount: input.customerIds.length, promotionName: input.promotionName },
      () => this.sendPromotionVoucher(input),
    );
  }

  queuePromotionVoucherForGroup(groupId: number, input: Omit<PromotionEmailInput, 'customerIds'>): void {
    this.runInBackground(
      'Customer-group promotion email',
      { groupId, promotionName: input.promotionName },
      async () => {
        const customerIds = await this.customerIdsForGroup(groupId);
        return this.sendPromotionVoucher({ ...input, customerIds });
      },
    );
  }

  private layout(title: string, name: string, content: string) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f3ee;font-family:Arial,sans-serif;color:#292524">
<div style="max-width:620px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
<div style="background:#6b4f35;color:#fff;padding:22px 28px"><div style="font-size:24px;font-weight:700">Nivaana</div></div>
<div style="padding:28px"><h1 style="font-size:22px;margin:0 0 18px">${escapeHtml(title)}</h1>
<p>Hello ${escapeHtml(name)},</p>${content}</div>
<div style="padding:18px 28px;background:#fafaf9;color:#78716c;font-size:12px">This is an automated Nivaana email. Please do not reply.</div>
</div></body></html>`;
  }

  private async sendToCustomer(
    customerId: number,
    subject: string,
    build: (customerName: string) => { html: string; text: string }
  ): Promise<CustomerEmailResult> {
    const customer = await this.database.users.findUnique({
      where: { id: customerId },
      select: { id: true, useremail: true, firstname: true, lastname: true }
    });
    if (!customer) {
      logger.warn({ customerId, subject }, 'Skipping customer email because customer was not found');
      return { sent: false, reason: 'missing_customer' };
    }

    const email = customer.useremail?.trim();
    if (!email) {
      logger.info({ customerId, subject }, 'Skipping customer email because customer has no email address');
      return { sent: false, reason: 'missing_email' };
    }

    const name = [customer.firstname, customer.lastname].filter(Boolean).join(' ').trim() || 'Customer';
    const message = build(name);
    try {
      await this.emailService.sendTransactionalEmail({ to: email, subject, ...message });
      return { sent: true, email };
    } catch (error) {
      logger.error({ error, customerId, subject }, 'Customer email failed without blocking the business operation');
      return { sent: false, reason: 'send_failed' };
    }
  }

  async sendOrderEmail(orderId: number, kind: OrderEmailKind, details: OrderEmailDetails = {}): Promise<CustomerEmailResult> {
    const order = await this.database.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true, userid: true, orderid: true, orderamount: true, mode: true,
        orderstatus: true, tracking_id: true, vendor: true, public_tracking_link: true,
        refund_amount: true, refund_reference: true
      }
    });
    if (!order?.userid) {
      logger.info({ orderId, kind }, 'Skipping order email because the order has no customer');
      return { sent: false, reason: 'missing_customer' };
    }

    const orderNumber = order.orderid || String(order.id);
    const status = details.status || order.orderstatus || 'updated';
    const subjects: Record<OrderEmailKind, string> = {
      order_confirmation: `Order ${orderNumber} confirmed`,
      payment_confirmation: `Payment confirmed for order ${orderNumber}`,
      shipment_update: `Shipment update for order ${orderNumber}`,
      delivery_confirmation: `Order ${orderNumber} delivered`,
      order_cancellation: `Order ${orderNumber} cancelled`,
      refund_notification: `Refund update for order ${orderNumber}`,
    };

    return this.sendToCustomer(order.userid, subjects[kind], (name) => {
      const amount = formatMoney(kind === 'refund_notification'
        ? details.refundAmount ?? order.refund_amount
        : order.orderamount);
      let paragraphs: string[] = [];
      switch (kind) {
        case 'order_confirmation':
          paragraphs = [`Your order <strong>${escapeHtml(orderNumber)}</strong> has been confirmed.`, `Order total: <strong>${amount}</strong>.`];
          break;
        case 'payment_confirmation':
          paragraphs = [`We have confirmed your payment of <strong>${amount}</strong> for order <strong>${escapeHtml(orderNumber)}</strong>.`];
          break;
        case 'shipment_update':
          paragraphs = [
            `Your order <strong>${escapeHtml(orderNumber)}</strong> is now <strong>${escapeHtml(titleCaseStatus(status))}</strong>.`,
            order.tracking_id ? `Tracking ID: <strong>${escapeHtml(order.tracking_id)}</strong>${order.vendor ? ` via ${escapeHtml(order.vendor)}` : ''}.` : '',
            details.location ? `Current location: ${escapeHtml(details.location)}.` : '',
            details.description ? escapeHtml(details.description) : '',
            order.public_tracking_link ? `<a href="${escapeHtml(order.public_tracking_link)}">Track your order</a>` : '',
          ].filter(Boolean);
          break;
        case 'delivery_confirmation':
          paragraphs = [`Your order <strong>${escapeHtml(orderNumber)}</strong> has been delivered successfully.`];
          break;
        case 'order_cancellation':
          paragraphs = [
            `Your order <strong>${escapeHtml(orderNumber)}</strong> has been cancelled.`,
            details.reason ? `Reason: ${escapeHtml(details.reason)}.` : '',
            order.mode === 'cod' ? 'No payment refund is required for this cash-on-delivery order.' : 'If payment was collected, refund updates will be sent separately.',
          ].filter(Boolean);
          break;
        case 'refund_notification':
          paragraphs = [
            `Refund status for order <strong>${escapeHtml(orderNumber)}</strong>: <strong>${escapeHtml(titleCaseStatus(status))}</strong>.`,
            `Refund amount: <strong>${amount}</strong>.`,
            (details.refundReference || order.refund_reference) ? `Reference: <strong>${escapeHtml(details.refundReference || order.refund_reference)}</strong>.` : '',
          ].filter(Boolean);
          break;
      }
      const htmlContent = paragraphs.map((paragraph) => `<p style="line-height:1.6">${paragraph}</p>`).join('');
      const text = paragraphs.map((paragraph) => paragraph.replace(/<[^>]+>/g, '')).join('\n\n');
      return { html: this.layout(subjects[kind], name, htmlContent), text: `Hello ${name},\n\n${text}\n\nNivaana` };
    });
  }

  async sendPromotionVoucher(input: PromotionEmailInput): Promise<CustomerEmailResult[]> {
    const uniqueCustomerIds = [...new Set(input.customerIds.filter(Number.isInteger))];
    const endDate = formatDate(input.endDate);
    const startDate = formatDate(input.startDate);
    return Promise.all(uniqueCustomerIds.map((customerId) => {
      const subject = input.voucherCode
        ? `Your Nivaana voucher: ${input.voucherCode}`
        : `A Nivaana promotion is available for you`;
      return this.sendToCustomer(customerId, subject, (name) => {
        const details = [
          `<p style="line-height:1.6">You are eligible for <strong>${escapeHtml(input.promotionName)}</strong>.</p>`,
          input.description ? `<p style="line-height:1.6">${escapeHtml(input.description)}</p>` : '',
          input.voucherCode ? `<p style="font-size:20px">Voucher code: <strong>${escapeHtml(input.voucherCode)}</strong></p>` : '',
          startDate ? `<p>Valid from: ${escapeHtml(startDate)}</p>` : '',
          endDate ? `<p>Expires on: ${escapeHtml(endDate)}</p>` : '',
          input.usageLimit ? `<p>Usage limit: ${input.usageLimit}</p>` : '',
        ].filter(Boolean).join('');
        const text = [
          `Hello ${name},`, `You are eligible for ${input.promotionName}.`,
          input.description || '', input.voucherCode ? `Voucher code: ${input.voucherCode}` : '',
          startDate ? `Valid from: ${startDate}` : '', endDate ? `Expires on: ${endDate}` : '',
          input.usageLimit ? `Usage limit: ${input.usageLimit}` : '', 'Nivaana'
        ].filter(Boolean).join('\n\n');
        return { html: this.layout('Promotion available', name, details), text };
      });
    }));
  }

  async customerIdsForGroup(groupId: number): Promise<number[]> {
    const members = await this.database.customer_group_members.findMany({
      where: { customer_group_id: groupId, status: 'active' },
      select: { customer_id: true }
    });
    return members.map((member) => member.customer_id);
  }
}

export const customerEmailNotificationService = new CustomerEmailNotificationService();
