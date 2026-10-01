import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface SendVerificationEmailOptions {
  to: string;
  firstName?: string | null;
  token: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('MAIL_HOST');

    const port = this.configService.getOrThrow<number>('MAIL_PORT');

    const secure = this.configService.get<boolean>('MAIL_SECURE') ?? false;

    const user = this.configService.get<string>('MAIL_USER');

    const password = this.configService.get<string>('MAIL_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,

      ...(user && password
        ? {
            auth: {
              user,
              pass: password,
            },
          }
        : {}),
    });
  }

  async sendVerificationEmail(
    options: SendVerificationEmailOptions,
  ): Promise<void> {
    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');

    const fromEmail = this.configService.getOrThrow<string>('MAIL_FROM');

    const fromName =
      this.configService.get<string>('MAIL_FROM_NAME') ?? 'MINREX';

    const verificationUrl = new URL('/auth/verify-email', frontendUrl);

    verificationUrl.searchParams.set('token', options.token);

    const firstName = options.firstName?.trim();

    const greeting = firstName
      ? `Bonjour ${this.escapeHtml(firstName)},`
      : 'Bonjour,';

    const verificationLink = verificationUrl.toString();

    await this.transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,

      subject: 'Vérifiez votre adresse email – MINREX',

      text: `
${firstName ? `Bonjour ${firstName},` : 'Bonjour,'}

Bienvenue sur la plateforme MINREX.

Votre compte a été créé avec succès.

Pour finaliser votre inscription et activer votre compte, veuillez vérifier votre adresse email en utilisant le lien suivant :

${verificationLink}

Ce lien est valable pendant 30 minutes.

Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer ce message.

MINREX
Ministère des Relations Extérieures
République du Cameroun
    `.trim(),

      html: `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Vérification de votre compte MINREX</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color: #f4f6f8; padding: 32px 16px;"
    >
      <tr>
        <td align="center">

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 620px;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
            "
          >

            <!-- HEADER -->
            <tr>
              <td
                style="
                  background-color: #006b3c;
                  padding: 28px 32px;
                  text-align: center;
                "
              >
                <div
                  style="
                    font-size: 26px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: 0.5px;
                  "
                >
                  MINREX
                </div>

                <div
                  style="
                    margin-top: 6px;
                    font-size: 13px;
                    color: #d1fae5;
                  "
                >
                  Ministère des Relations Extérieures
                </div>
              </td>
            </tr>

            <!-- CAMEROON COLORS -->
            <tr>
              <td>
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                >
                  <tr>
                    <td
                      width="33.33%"
                      style="
                        height: 5px;
                        background-color: #007a5e;
                      "
                    ></td>

                    <td
                      width="33.33%"
                      style="
                        height: 5px;
                        background-color: #ce1126;
                      "
                    ></td>

                    <td
                      width="33.33%"
                      style="
                        height: 5px;
                        background-color: #fcd116;
                      "
                    ></td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td
                style="
                  padding: 40px 36px 24px 36px;
                "
              >
                <h1
                  style="
                    margin: 0 0 24px;
                    font-size: 24px;
                    line-height: 1.3;
                    color: #111827;
                  "
                >
                  Vérifiez votre adresse email
                </h1>

                <p
                  style="
                    margin: 0 0 18px;
                    font-size: 16px;
                    line-height: 1.7;
                    color: #374151;
                  "
                >
                  ${greeting}
                </p>

                <p
                  style="
                    margin: 0 0 18px;
                    font-size: 16px;
                    line-height: 1.7;
                    color: #374151;
                  "
                >
                  Bienvenue sur la plateforme
                  <strong>MINREX</strong>.
                  Votre compte a été créé avec succès.
                </p>

                <p
                  style="
                    margin: 0 0 30px;
                    font-size: 16px;
                    line-height: 1.7;
                    color: #374151;
                  "
                >
                  Pour finaliser votre inscription et activer
                  votre compte, veuillez confirmer votre adresse
                  email en cliquant sur le bouton ci-dessous.
                </p>

                <!-- BUTTON -->
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  align="center"
                  style="margin: 0 auto 30px;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#006b3c"
                      style="
                        border-radius: 8px;
                      "
                    >
                      <a
                        href="${verificationLink}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 15px 30px;
                          font-size: 16px;
                          font-weight: 700;
                          color: #ffffff;
                          text-decoration: none;
                          background-color: #006b3c;
                          border-radius: 8px;
                        "
                      >
                        Vérifier mon adresse email
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- EXPIRATION BOX -->
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin-bottom: 28px;
                    background-color: #f9fafb;
                    border-left: 4px solid #fcd116;
                    border-radius: 6px;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 16px 18px;
                        font-size: 14px;
                        line-height: 1.6;
                        color: #4b5563;
                      "
                    >
                      Ce lien de vérification est valable pendant
                      <strong>30 minutes</strong>.
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin: 0 0 10px;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #6b7280;
                  "
                >
                  Si le bouton ne fonctionne pas, copiez et
                  collez le lien suivant dans votre navigateur :
                </p>

                <p
                  style="
                    margin: 0;
                    padding: 12px;
                    background-color: #f3f4f6;
                    border-radius: 6px;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #4b5563;
                    word-break: break-all;
                  "
                >
                  ${verificationLink}
                </p>
              </td>
            </tr>

            <!-- SECURITY -->
            <tr>
              <td
                style="
                  padding: 0 36px 32px;
                "
              >
                <div
                  style="
                    border-top: 1px solid #e5e7eb;
                    padding-top: 24px;
                  "
                >
                  <p
                    style="
                      margin: 0;
                      font-size: 13px;
                      line-height: 1.6;
                      color: #6b7280;
                    "
                  >
                    Si vous n'êtes pas à l'origine de cette
                    inscription, aucune action n'est requise.
                    Vous pouvez ignorer cet email en toute sécurité.
                  </p>
                </div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td
                style="
                  background-color: #111827;
                  padding: 26px 32px;
                  text-align: center;
                "
              >
                <p
                  style="
                    margin: 0 0 7px;
                    font-size: 13px;
                    color: #f9fafb;
                    font-weight: 600;
                  "
                >
                  Ministère des Relations Extérieures
                </p>

                <p
                  style="
                    margin: 0 0 12px;
                    font-size: 12px;
                    color: #9ca3af;
                  "
                >
                  République du Cameroun
                </p>

                <p
                  style="
                    margin: 0;
                    font-size: 11px;
                    color: #6b7280;
                  "
                >
                  Ceci est un message automatique.
                  Merci de ne pas répondre directement à cet email.
                </p>
              </td>
            </tr>

          </table>

          <p
            style="
              margin: 20px 0 0;
              font-size: 11px;
              color: #9ca3af;
              text-align: center;
            "
          >
            © ${new Date().getFullYear()} MINREX.
            Tous droits réservés.
          </p>

        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim(),
    });

    this.logger.log(`Verification email sent to ${options.to}`);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
