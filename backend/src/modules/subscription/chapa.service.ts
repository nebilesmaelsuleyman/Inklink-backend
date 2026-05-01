import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChapaInitPayload {
  amount: string | number;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

export interface ChapaInitResponse {
  message: string;
  status: string;
  data: {
    checkout_url: string;
  };
}

export interface ChapaVerifyResponse {
  message: string;
  status: string;
  data: {
    first_name: string;
    last_name: string;
    email: string;
    currency: string;
    amount: number;
    charge: number;
    mode: string;
    method: string;
    type: string;
    status: string;
    reference: string;
    tx_ref: string;
    customization: any;
    meta: any;
    created_at: string;
    updated_at: string;
  };
}

@Injectable()
export class ChapaService {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.chapa.co/v1';

  constructor(private readonly configService: ConfigService) {
    this.secretKey = (
      this.configService.get<string>('CHAPA_SECRET_KEY') || 
      process.env.CHAPA_SECRET_KEY ||
      this.configService.get<string>('Test_secret_key') ||
      process.env.Test_secret_key ||
      'CHASECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    ).trim();

    console.log('[ChapaService] Secret Key loaded:', 
      this.secretKey.startsWith('CHASECK_TEST-') ? 'Valid Format' : 'INVALID FORMAT',
      this.secretKey.substring(0, 15) + '...'
    );
  }

  /** Initialize a payment and get Chapa's hosted checkout URL */
  async initializePayment(payload: ChapaInitPayload): Promise<ChapaInitResponse> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          amount: String(payload.amount),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ChapaService] API Error Data:', errorData);
        const errorMessage = typeof errorData.message === 'string' 
          ? errorData.message 
          : JSON.stringify(errorData.message || errorData);
        throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json() as ChapaInitResponse;
    } catch (error: any) {
      const message = error.message || 'Payment initialization failed';
      console.error('[ChapaService] Initialize failed:', message);
      throw new BadRequestException(`Chapa error: ${message}`);
    }
  }

  /** Verify a transaction by its tx_ref */
  async verifyPayment(txRef: string): Promise<ChapaVerifyResponse> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/transaction/verify/${txRef}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json() as ChapaVerifyResponse;
    } catch (error: any) {
      const message = error.message || 'Payment verification failed';
      console.error('[ChapaService] Verify failed:', message);
      throw new BadRequestException(`Chapa verify error: ${message}`);
    }
  }

  /** Generate a unique transaction reference */
  generateTxRef(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }
}
