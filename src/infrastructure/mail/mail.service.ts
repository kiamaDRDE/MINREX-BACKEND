import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import {
  buildConsularIdentityEmail,
  buildNotificationEmail,
  buildOtpEmail,
  buildVerificationEmail,
} from './templates/mail-templates.js';

export interface SendVerificationEmailOptions {
  to: string;
  firstName?: string | null;
  token: string;
}

export interface SendNotificationEmailOptions {
  to: string;
  recipientName?: string | null;
  subject: string;
  title: string;
  content: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string | null;
  actionLabel?: string;
}

export interface SendOtpEmailOptions {
  to: string;
  firstName?: string | null;
  code: string;
  purposeLabel: string;
  expiresMinutes?: number;
}

export interface SendConsularIdentityEmailOptions {
  to: string;
  firstName?: string | null;
  consularIdentifier: string;
  postName?: string | null;
}

interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKET',
  'ECONNECTION',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
]);

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly maxConcurrentJobs: number;
  private readonly pendingJobs: Array<() => Promise<void>> = [];
  private activeWorkers = 0;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('MAIL_HOST');
    const port = this.configService.getOrThrow<number>('MAIL_PORT');
    const secure = this.configService.get<boolean>('MAIL_SECURE') ?? false;
    const user = this.configService.get<string>('MAIL_USER')?.trim();
    const password = this.configService.get<string>('MAIL_PASSWORD');

    const poolEnabled = this.configService.get<boolean>('MAIL_POOL') ?? true;
    const maxConnections =
      this.configService.get<number>('MAIL_MAX_CONNECTIONS') ?? 4;
    const maxMessages = this.configService.get<number>('MAIL_MAX_MESSAGES') ?? 100;
    const rateLimit = this.configService.get<number>('MAIL_RATE_LIMIT') ?? 5;
    const rateDelta =
      this.configService.get<number>('MAIL_RATE_DELTA_MS') ?? 1000;
    const connectionTimeout =
      this.configService.get<number>('MAIL_CONNECTION_TIMEOUT_MS') ?? 10000;
    const socketTimeout =
      this.configService.get<number>('MAIL_SOCKET_TIMEOUT_MS') ?? 15000;

    this.maxConcurrentJobs = Math.max(1, maxConnections);

    const authConfig =
      user && password
        ? {
            auth: {
              user,
              pass: password,
            },
          }
        : {};

    if (poolEnabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        pool: true,
        maxConnections,
        maxMessages,
        rateLimit,
        rateDelta,
        connectionTimeout,
        greetingTimeout: connectionTimeout,
        socketTimeout,
        ...authConfig,
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        connectionTimeout,
        greetingTimeout: connectionTimeout,
        socketTimeout,
        ...authConfig,
      });
    }
  }

  onModuleDestroy(): void {
    try {
      this.transporter.close();
    } catch {
      // Ignore cleanup errors on shutdown
    }
  }

  async verifyTransport(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.warn(
        `SMTP verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<void> {
    const verificationUrl = this.resolveFrontendUrl('/auth/verify-email');
    if (!verificationUrl) {
      throw new Error('FRONTEND_URL must be configured to send verification emails.');
    }
    const url = new URL(verificationUrl);
    url.searchParams.set('token', options.token);

    const rendered = buildVerificationEmail({
      firstName: options.firstName,
      verificationLink: url.toString(),
    });

    await this.sendMailWithRetry({
      to: options.to,
      ...rendered,
    });

    this.logger.log(`Verification email sent to ${options.to}`);
  }

  async sendOtpEmail(options: SendOtpEmailOptions): Promise<void> {
    const rendered = buildOtpEmail({
      firstName: options.firstName,
      code: options.code,
      purposeLabel: options.purposeLabel,
      expiresMinutes: options.expiresMinutes ?? 5,
    });

    await this.sendMailWithRetry({
      to: options.to,
      ...rendered,
    });

    this.logger.log(`OTP verification email sent to ${options.to}`);
  }

  async sendNotificationEmail(
    options: SendNotificationEmailOptions,
  ): Promise<void> {
    const resolvedActionUrl = this.resolveFrontendUrl(options.actionUrl);

    const rendered = buildNotificationEmail({
      recipientName: options.recipientName,
      subject: options.subject,
      title: options.title,
      content: options.content,
      priority: options.priority,
      actionUrl: resolvedActionUrl,
      actionLabel: options.actionLabel ?? 'Consulter sur le portail',
    });

    await this.sendMailWithRetry({
      to: options.to,
      ...rendered,
    });

    this.logger.log(
      `Notification email sent to ${options.to} (${options.subject})`,
    );
  }

  async sendConsularIdentityEmail(
    options: SendConsularIdentityEmailOptions,
  ): Promise<void> {
    const loginUrl = this.resolveFrontendUrl('/connexion') ?? '';
    const rendered = buildConsularIdentityEmail({
      firstName: options.firstName,
      consularIdentifier: options.consularIdentifier,
      postName: options.postName,
      loginUrl,
    });

    await this.sendMailWithRetry({
      to: options.to,
      ...rendered,
    });

    this.logger.log(
      `Consular identity email (${options.consularIdentifier}) sent to ${options.to}`,
    );
  }

  enqueueNotificationEmail(options: SendNotificationEmailOptions): void {
    this.enqueueJob(async () => {
      try {
        await this.sendNotificationEmail(options);
      } catch (error) {
        this.logger.error(
          `Failed to send notification email to ${options.to}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
  }

  enqueueConsularIdentityEmail(options: SendConsularIdentityEmailOptions): void {
    this.enqueueJob(async () => {
      try {
        await this.sendConsularIdentityEmail(options);
      } catch (error) {
        this.logger.error(
          `Failed to send consular identity email to ${options.to}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
  }

  resolveFrontendUrl(pathOrUrl?: string | null): string | null {
    const raw = pathOrUrl?.trim();
    if (!raw) {
      return null;
    }

    const frontendBase = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');

    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).toString();
      } catch {
        return null;
      }
    }

    if (raw.startsWith('/')) {
      try {
        return new URL(raw, `${frontendBase}/`).toString();
      } catch {
        return null;
      }
    }

    return null;
  }

  protected async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async sendMailWithRetry(payload: MailPayload): Promise<void> {
    const fromEmail = this.configService.getOrThrow<string>('MAIL_FROM');
    const fromName =
      this.configService.get<string>('MAIL_FROM_NAME') ?? 'MINREX';
    const replyTo = this.configService.get<string>('MAIL_REPLY_TO')?.trim();

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          ...(replyTo ? { replyTo } : {}),
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        });
        return;
      } catch (error) {
        const shouldRetry =
          attempt < maxAttempts && this.isTransientSmtpError(error);
        if (!shouldRetry) {
          throw error;
        }
        const delayMs = 300 * attempt;
        this.logger.warn(
          `Transient SMTP error on attempt ${attempt}/${maxAttempts} for ${payload.to}; retrying in ${delayMs}ms.`,
        );
        await this.sleep(delayMs);
      }
    }
  }

  private isTransientSmtpError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const errRecord = error as Record<string, unknown>;
    const code = typeof errRecord['code'] === 'string' ? errRecord['code'] : '';
    if (TRANSIENT_NET_CODES.has(code)) {
      return true;
    }

    const responseCode = errRecord['responseCode'];
    return (
      typeof responseCode === 'number' &&
      responseCode >= 400 &&
      responseCode < 500
    );
  }

  private enqueueJob(job: () => Promise<void>): void {
    this.pendingJobs.push(job);
    this.drainQueue();
  }

  private drainQueue(): void {
    while (
      this.activeWorkers < this.maxConcurrentJobs &&
      this.pendingJobs.length > 0
    ) {
      const nextJob = this.pendingJobs.shift();
      if (!nextJob) break;

      this.activeWorkers += 1;
      void nextJob().finally(() => {
        this.activeWorkers = Math.max(0, this.activeWorkers - 1);
        this.drainQueue();
      });
    }
  }
}
