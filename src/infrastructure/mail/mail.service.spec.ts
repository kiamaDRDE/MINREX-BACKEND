import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';

import { MailService } from './mail.service.js';

class TestableMailService extends MailService {
  public setMockTransporter(mock: {
    sendMail: (...args: unknown[]) => Promise<unknown>;
    verify: () => Promise<boolean>;
    close: () => void;
  }): void {
    (this as unknown as { transporter: unknown }).transporter = mock;
  }

  protected override async sleep(): Promise<void> {
    // No delay during unit tests
  }
}

describe('MailService', () => {
  const sendMailMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const verifyMock = jest.fn<() => Promise<boolean>>();
  const closeMock = jest.fn<() => void>();

  const envMap: Record<string, unknown> = {
    MAIL_HOST: 'smtp-relay.brevo.com',
    MAIL_PORT: 587,
    MAIL_SECURE: false,
    MAIL_USER: 'test@minrex.local',
    MAIL_PASSWORD: 'secret-password',
    MAIL_FROM: 'reply@minrex.cm',
    MAIL_FROM_NAME: 'MINREX',
    MAIL_REPLY_TO: 'support@minrex.cm',
    MAIL_POOL: true,
    MAIL_MAX_CONNECTIONS: 4,
    MAIL_MAX_MESSAGES: 100,
    MAIL_RATE_LIMIT: 5,
    MAIL_RATE_DELTA_MS: 1000,
    MAIL_CONNECTION_TIMEOUT_MS: 10000,
    MAIL_SOCKET_TIMEOUT_MS: 15000,
    FRONTEND_URL: 'https://diaspora.minrex.cm/',
  };

  const configMock = {
    get: jest.fn((key: string) => envMap[key]),
    getOrThrow: jest.fn((key: string) => {
      const val = envMap[key];
      if (val === undefined) {
        throw new Error(`Missing config ${key}`);
      }
      return val;
    }),
  } as unknown as ConfigService;

  let service: TestableMailService;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    verifyMock.mockResolvedValue(true);

    service = new TestableMailService(configMock);
    service.setMockTransporter({
      sendMail: sendMailMock,
      verify: verifyMock,
      close: closeMock,
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('resolves relative frontend URLs and blocks unsafe schemes', () => {
    expect(service.resolveFrontendUrl('/espace/assistance')).toBe(
      'https://diaspora.minrex.cm/espace/assistance',
    );
    expect(service.resolveFrontendUrl('https://minrex.cm/info')).toBe(
      'https://minrex.cm/info',
    );
    expect(service.resolveFrontendUrl('javascript:alert(1)')).toBeNull();
    expect(service.resolveFrontendUrl('   ')).toBeNull();
  });

  it('escapes HTML and includes Cameroon tricolor branding in notification emails', async () => {
    await service.sendNotificationEmail({
      to: 'citoyen@example.com',
      recipientName: 'Nadine <Mbarga>',
      subject: 'Mise à jour dossier',
      title: 'Dossier validé',
      content: 'Ligne 1\n<script>alert(1)</script>',
      priority: 'URGENT',
      actionUrl: '/espace/recensement',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailMock.mock.calls[0]?.[0] as {
      to: string;
      replyTo?: string;
      html: string;
    };

    expect(mailArgs.to).toBe('citoyen@example.com');
    expect(mailArgs.replyTo).toBe('support@minrex.cm');
    expect(mailArgs.html).toContain('Nadine &lt;Mbarga&gt;');
    expect(mailArgs.html).toContain('Ligne 1<br />&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mailArgs.html).not.toContain('<script>');
    expect(mailArgs.html).toContain('https://diaspora.minrex.cm/espace/recensement');
    expect(mailArgs.html).toContain('#ce1126');
    expect(mailArgs.html).toContain('Alerte Urgente');
  });

  it('retries transient SMTP 421 throttling errors before succeeding', async () => {
    sendMailMock
      .mockRejectedValueOnce(Object.assign(new Error('Too many connections'), { responseCode: 421 }))
      .mockResolvedValueOnce({ messageId: 'msg-retry-ok' });

    await service.sendOtpEmail({
      to: 'citoyen@example.com',
      firstName: 'Jean',
      code: '482910',
      purposeLabel: 'Connexion OTP',
      expiresMinutes: 5,
    });

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    const mailArgs = sendMailMock.mock.calls[1]?.[0] as { html: string; subject: string };
    expect(mailArgs.subject).toContain('482910');
    expect(mailArgs.html).toContain('482910');
  });

  it('does not retry permanent 550 recipient rejections', async () => {
    sendMailMock.mockRejectedValueOnce(
      Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 }),
    );

    await expect(
      service.sendVerificationEmail({
        to: 'bad@example.com',
        firstName: 'Test',
        token: 'a'.repeat(64),
      }),
    ).rejects.toThrow('Mailbox unavailable');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('queues verification emails asynchronously without blocking caller', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'msg-queued-verify' });

    service.enqueueVerificationEmail({
      to: 'queued@example.com',
      firstName: 'Amina',
      token: 'b'.repeat(64),
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailMock.mock.calls[0]?.[0] as { to: string; html: string };
    expect(mailArgs.to).toBe('queued@example.com');
    expect(mailArgs.html).toContain('/auth/verify-email?token=');
  });

  it('closes transporter pool cleanly on module destroy', () => {
    service.onModuleDestroy();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
