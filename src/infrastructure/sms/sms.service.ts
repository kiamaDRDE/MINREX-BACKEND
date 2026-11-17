import { createHash } from 'node:crypto';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../cache/redis.service.js';

export type SmsProviderType =
  | 'mock'
  | 'twilio'
  | 'brevo'
  | 'infobip'
  | 'webhook';

export interface SendOtpSmsOptions {
  to: string;
  code: string;
  purposeLabel: string;
  expiresMinutes?: number;
}

export interface SmsCapabilities {
  provider: SmsProviderType;
  smsEnabled: boolean;
  productionReady: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  getCapabilities(): SmsCapabilities {
    const provider =
      (this.configService.get<SmsProviderType>('SMS_PROVIDER') ?? 'mock');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    if (provider === 'mock') {
      return {
        provider,
        smsEnabled: nodeEnv !== 'production',
        productionReady: false,
      };
    }

    const ready = this.hasCredentialsFor(provider);
    return {
      provider,
      smsEnabled: ready,
      productionReady: ready,
    };
  }

  async sendOtpSms(
    options: SendOtpSmsOptions,
  ): Promise<{ provider: SmsProviderType; simulated: boolean }> {
    const provider =
      (this.configService.get<SmsProviderType>('SMS_PROVIDER') ?? 'mock');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const sender =
      this.configService.get<string>('SMS_SENDER_ID')?.trim() || 'MINREX-CMR';
    const expiresMinutes = options.expiresMinutes ?? 5;

    const text = `MINREX PNMD-CMR : Votre code (${options.purposeLabel}) est ${options.code}. Valable ${expiresMinutes} min. Ne le partagez jamais.`;

    if (provider === 'mock') {
      if (nodeEnv === 'production') {
        throw new ServiceUnavailableException(
          'La passerelle SMS de production n’est pas encore configurée. Utilisez la vérification par e-mail.',
        );
      }

      await this.storeDevSmsPreview(options.to, text, expiresMinutes);
      this.logger.log(
        `[SMS MOCK -> ${this.maskPhone(options.to)}] Code OTP (${options.purposeLabel}) généré.`,
      );
      return { provider: 'mock', simulated: true };
    }

    switch (provider) {
      case 'twilio':
        await this.sendViaTwilio(options.to, text);
        break;
      case 'brevo':
        await this.sendViaBrevo(sender, options.to, text);
        break;
      case 'infobip':
        await this.sendViaInfobip(sender, options.to, text);
        break;
      case 'webhook':
        await this.sendViaWebhook(sender, options.to, text, options.purposeLabel);
        break;
    }

    this.logger.log(
      `OTP SMS dispatched via ${provider} to ${this.maskPhone(options.to)}`,
    );
    return { provider, simulated: false };
  }

  private hasCredentialsFor(provider: Exclude<SmsProviderType, 'mock'>): boolean {
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim();
    const apiSecret = this.configService.get<string>('SMS_API_SECRET')?.trim();
    const apiUrl = this.configService.get<string>('SMS_API_URL')?.trim();
    const accountSid = this.configService.get<string>('SMS_ACCOUNT_SID')?.trim();
    const fromNumber = this.configService.get<string>('SMS_FROM_NUMBER')?.trim();

    switch (provider) {
      case 'twilio':
        return Boolean(accountSid && (apiSecret || apiKey) && fromNumber);
      case 'brevo':
        return Boolean(apiKey);
      case 'infobip':
        return Boolean(apiKey);
      case 'webhook':
        return Boolean(apiUrl);
    }
  }

  private async sendViaTwilio(to: string, body: string): Promise<void> {
    const accountSid = this.configService.get<string>('SMS_ACCOUNT_SID')?.trim();
    const token =
      this.configService.get<string>('SMS_API_SECRET')?.trim() ||
      this.configService.get<string>('SMS_API_KEY')?.trim();
    const from = this.configService.get<string>('SMS_FROM_NUMBER')?.trim();

    if (!accountSid || !token || !from) {
      throw new ServiceUnavailableException(
        'Identifiants Twilio incomplets (SMS_ACCOUNT_SID, SMS_API_SECRET, SMS_FROM_NUMBER).',
      );
    }

    const credentials = Buffer.from(`${accountSid}:${token}`).toString('base64');
    const form = new URLSearchParams({ To: to, From: from, Body: body });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Échec d’envoi SMS Twilio (${response.status}): ${detail.slice(0, 160)}`,
      );
    }
  }

  private async sendViaBrevo(
    sender: string,
    recipient: string,
    content: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Clé API Brevo SMS manquante (SMS_API_KEY).');
    }

    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: sender.slice(0, 11),
        recipient,
        content,
        type: 'transactional',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Échec d’envoi SMS Brevo (${response.status}): ${detail.slice(0, 160)}`,
      );
    }
  }

  private async sendViaInfobip(
    from: string,
    to: string,
    text: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim();
    const baseUrl =
      this.configService.get<string>('SMS_API_URL')?.trim().replace(/\/$/, '') ||
      'https://api.infobip.com';

    if (!apiKey) {
      throw new ServiceUnavailableException('Clé API Infobip manquante (SMS_API_KEY).');
    }

    const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to }],
            from,
            text,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Échec d’envoi SMS Infobip (${response.status}): ${detail.slice(0, 160)}`,
      );
    }
  }

  private async sendViaWebhook(
    sender: string,
    to: string,
    message: string,
    purpose: string,
  ): Promise<void> {
    const url = this.configService.get<string>('SMS_API_URL')?.trim();
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim();

    if (!url) {
      throw new ServiceUnavailableException('URL de passerelle SMS manquante (SMS_API_URL).');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ to, sender, message, purpose }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Échec d’envoi SMS passerelle (${response.status}).`,
      );
    }
  }

  private async storeDevSmsPreview(
    phone: string,
    message: string,
    expiresMinutes: number,
  ): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (client.status !== 'ready') return;

      const digest = createHash('sha256').update(phone).digest('hex');
      await client.set(
        `minrex:dev:sms-otp:${digest}`,
        JSON.stringify({ message, createdAt: new Date().toISOString() }),
        'EX',
        expiresMinutes * 60,
      );
    } catch {
      // Never block dev OTP generation on Redis preview logging
    }
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  }
}
