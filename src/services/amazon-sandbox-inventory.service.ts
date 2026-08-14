import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

type LwaTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type AmazonInventoryDetails = {
  fulfillableQuantity?: number;
  reservedQuantity?: {
    totalReservedQuantity?: number;
    pendingCustomerOrderQuantity?: number;
  };
};

type AmazonInventorySummary = {
  asin?: string;
  fnSku?: string;
  sellerSku?: string;
  productName?: string;
  condition?: string;
  totalQuantity?: number;
  inventoryDetails?: AmazonInventoryDetails;
};

type AmazonInventoryResponse = {
  payload?: {
    inventorySummaries?: AmazonInventorySummary[];
    pagination?: {
      nextToken?: string;
    };
  };
};

export type SandboxInventoryItem = {
  asin: string | null;
  fnSku: string | null;
  sellerSku: string;
  productName: string | null;
  condition: string | null;
  fulfillableQuantity: number;
  reservedQuantity: number;
  pendingCustomerOrderQuantity: number;
  totalQuantity: number;
};

export type SandboxInventoryResult = {
  environment: 'SANDBOX';
  marketplaceId: string;
  items: SandboxInventoryItem[];
  nextToken: string | null;
};

export type CreateSandboxInventoryItemInput = {
  sellerSku: string;
  productName: string;
};

export type SandboxInventoryMutationResult = {
  environment: 'SANDBOX';
  marketplaceId: string;
  sellerSku: string;
  operation: 'CREATED' | 'QUANTITY_ADDED' | 'QUANTITY_DEPLETED' | 'DELETED';
  quantityAdded?: number;
  quantityDepleted?: number;
  fulfillmentOrderId?: string;
};

export class AmazonSandboxInventoryService {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  private requiredConfig(name: string, value?: string): string {
    if (!value) {
      throw new Error(`${name} is not configured on the backend`);
    }

    return value;
  }

  private getCredentialConfig(): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  } {
    if (env.AMAZON_SANDBOX_CREDENTIAL_SOURCE === 'PRODUCTION') {
      return {
        clientId: this.requiredConfig('AMAZON_CLIENT_ID', env.AMAZON_CLIENT_ID),
        clientSecret: this.requiredConfig('AMAZON_CLIENT_SECRET', env.AMAZON_CLIENT_SECRET),
        refreshToken: this.requiredConfig('AMAZON_REFRESH_TOKEN', env.AMAZON_REFRESH_TOKEN),
      };
    }

    return {
      clientId: this.requiredConfig('AMAZON_SANDBOX_CLIENT_ID', env.AMAZON_SANDBOX_CLIENT_ID),
      clientSecret: this.requiredConfig('AMAZON_SANDBOX_CLIENT_SECRET', env.AMAZON_SANDBOX_CLIENT_SECRET),
      refreshToken: this.requiredConfig('AMAZON_SANDBOX_REFRESH_TOKEN', env.AMAZON_SANDBOX_REFRESH_TOKEN),
    };
  }

  private async exchangeRefreshToken(refreshToken: string): Promise<LwaTokenResponse> {
    const { clientId, clientSecret } = this.getCredentialConfig();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await axios.post<LwaTokenResponse>(AMAZON_LWA_TOKEN_URL, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      timeout: 15_000,
    });

    return response.data;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const { refreshToken } = this.getCredentialConfig();
    const tokenResponse = await this.exchangeRefreshToken(refreshToken);

    this.accessToken = tokenResponse.access_token;
    // Refresh one minute before Amazon's reported expiry.
    this.accessTokenExpiresAt = Date.now() + Math.max(tokenResponse.expires_in - 60, 60) * 1000;

    return this.accessToken;
  }

  private getSandboxBaseUrl(): string {
    const configuredUrl = this.requiredConfig(
      'AMAZON_SANDBOX_SP_API_BASE_URL',
      env.AMAZON_SANDBOX_SP_API_BASE_URL
    ).replace(/\/$/, '');
    const parsedUrl = new URL(configuredUrl);

    if (
      parsedUrl.protocol !== 'https:'
      || !/^sandbox\.sellingpartnerapi-(na|eu|fe)\.amazon\.com$/i.test(parsedUrl.hostname)
    ) {
      throw new Error('Amazon sandbox service refused a non-sandbox SP-API endpoint');
    }

    return configuredUrl;
  }

  private async getSandboxRequestHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();

    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-amz-access-token': accessToken,
    };
  }

  async validateConnection(refreshToken?: string): Promise<{
    sellerId: string;
    marketplaceId: string;
    initialized: true;
    environment: 'SANDBOX';
  }> {
    const tokenToValidate = refreshToken?.trim()
      || this.getCredentialConfig().refreshToken;

    await this.exchangeRefreshToken(tokenToValidate);

    return {
      sellerId: env.AMAZON_SELLER_ID ?? 'AMAZON_SANDBOX',
      marketplaceId: env.AMAZON_MARKETPLACE_ID,
      initialized: true,
      environment: 'SANDBOX',
    };
  }

  async createInventoryItem(
    input: CreateSandboxInventoryItemInput
  ): Promise<SandboxInventoryMutationResult> {
    const marketplaceId = env.AMAZON_MARKETPLACE_ID;
    const baseUrl = this.getSandboxBaseUrl();
    const headers = await this.getSandboxRequestHeaders();

    await axios.post(
      `${baseUrl}/fba/inventory/v1/items`,
      {
        sellerSku: input.sellerSku,
        marketplaceId,
        productName: input.productName,
      },
      {
        headers,
        timeout: 20_000,
      }
    );

    return {
      environment: 'SANDBOX',
      marketplaceId,
      sellerSku: input.sellerSku,
      operation: 'CREATED',
    };
  }

  async addInventory(
    sellerSku: string,
    quantity: number,
    idempotencyToken: string = randomUUID()
  ): Promise<SandboxInventoryMutationResult> {
    const marketplaceId = env.AMAZON_MARKETPLACE_ID;
    const baseUrl = this.getSandboxBaseUrl();
    const headers = await this.getSandboxRequestHeaders();

    await axios.post(
      `${baseUrl}/fba/inventory/v1/items/inventory`,
      {
        inventoryItems: [
          {
            sellerSku,
            marketplaceId,
            quantity,
          },
        ],
      },
      {
        headers: {
          ...headers,
          'x-amzn-idempotency-token': idempotencyToken,
        },
        timeout: 20_000,
      }
    );

    return {
      environment: 'SANDBOX',
      marketplaceId,
      sellerSku,
      operation: 'QUANTITY_ADDED',
      quantityAdded: quantity,
    };
  }

  /**
   * The FBA Inventory dynamic sandbox has no direct subtract operation.
   * Amazon requires a virtual Fulfillment Outbound order to consume inventory.
   */
  async depleteInventory(
    sellerSku: string,
    quantity: number
  ): Promise<SandboxInventoryMutationResult> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Amazon sandbox depletion quantity must be a positive integer');
    }

    const marketplaceId = env.AMAZON_MARKETPLACE_ID;
    const baseUrl = this.getSandboxBaseUrl();
    const headers = await this.getSandboxRequestHeaders();
    const uniquePart = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const fulfillmentOrderId = `TEST-NIV-SYNC-${uniquePart}`.slice(0, 40);
    const fulfillmentItemId = `${fulfillmentOrderId}-1`.slice(0, 50);
    const orderUrl = `${baseUrl}/fba/outbound/2020-07-01/fulfillmentOrders`;

    await axios.post(
      orderUrl,
      {
        marketplaceId,
        sellerFulfillmentOrderId: fulfillmentOrderId,
        displayableOrderId: fulfillmentOrderId,
        displayableOrderDate: new Date().toISOString(),
        displayableOrderComment: 'Nivaana sandbox inventory synchronization',
        shippingSpeedCategory: 'Standard',
        fulfillmentAction: 'Ship',
        fulfillmentPolicy: 'FillAllAvailable',
        destinationAddress: {
          name: 'Nivaana Sandbox',
          addressLine1: '1 Test Road',
          city: 'Chennai',
          stateOrRegion: 'Tamil Nadu',
          postalCode: '600001',
          countryCode: 'IN',
        },
        items: [
          {
            sellerSku,
            sellerFulfillmentOrderItemId: fulfillmentItemId,
            quantity,
          },
        ],
      },
      {
        headers,
        timeout: 20_000,
      }
    );

    const statusUrl = `${orderUrl}/${encodeURIComponent(fulfillmentOrderId)}/status`;
    for (const fulfillmentOrderStatus of ['Processing', 'Complete']) {
      await axios.put(
        statusUrl,
        { fulfillmentOrderStatus },
        {
          headers,
          timeout: 20_000,
        }
      );
    }

    return {
      environment: 'SANDBOX',
      marketplaceId,
      sellerSku,
      operation: 'QUANTITY_DEPLETED',
      quantityDepleted: quantity,
      fulfillmentOrderId,
    };
  }

  async deleteInventoryItem(sellerSku: string): Promise<SandboxInventoryMutationResult> {
    const marketplaceId = env.AMAZON_MARKETPLACE_ID;
    const baseUrl = this.getSandboxBaseUrl();
    const headers = await this.getSandboxRequestHeaders();

    await axios.delete(
      `${baseUrl}/fba/inventory/v1/items/${encodeURIComponent(sellerSku)}`,
      {
        headers,
        params: { marketplaceId },
        timeout: 20_000,
      }
    );

    return {
      environment: 'SANDBOX',
      marketplaceId,
      sellerSku,
      operation: 'DELETED',
    };
  }

  async getInventorySummaries(
    nextToken?: string,
    sellerSku?: string
  ): Promise<SandboxInventoryResult> {
    const marketplaceId = env.AMAZON_MARKETPLACE_ID;
    const baseUrl = this.getSandboxBaseUrl();
    const headers = await this.getSandboxRequestHeaders();

    const response = await axios.get<AmazonInventoryResponse>(
      `${baseUrl}/fba/inventory/v1/summaries`,
      {
        headers,
        params: {
          details: true,
          granularityType: 'Marketplace',
          granularityId: marketplaceId,
          marketplaceIds: marketplaceId,
          ...(sellerSku ? { sellerSku } : {}),
          ...(nextToken ? { nextToken } : {}),
        },
        timeout: 20_000,
      }
    );

    const payload = response.data.payload;
    const summaries = payload?.inventorySummaries ?? [];

    const items = summaries.map((summary): SandboxInventoryItem => {
      const inventoryDetails = summary.inventoryDetails;
      const reservedQuantity = inventoryDetails?.reservedQuantity;

      return {
        asin: summary.asin ?? null,
        fnSku: summary.fnSku ?? null,
        sellerSku: summary.sellerSku ?? '',
        productName: summary.productName ?? null,
        condition: summary.condition ?? null,
        fulfillableQuantity: inventoryDetails?.fulfillableQuantity ?? 0,
        reservedQuantity: reservedQuantity?.totalReservedQuantity ?? 0,
        pendingCustomerOrderQuantity: reservedQuantity?.pendingCustomerOrderQuantity ?? 0,
        totalQuantity: summary.totalQuantity ?? 0,
      };
    });

    return {
      environment: 'SANDBOX',
      marketplaceId,
      items,
      nextToken: payload?.pagination?.nextToken ?? null,
    };
  }
}

export const amazonSandboxInventoryService = new AmazonSandboxInventoryService();
