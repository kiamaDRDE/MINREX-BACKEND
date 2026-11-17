export interface RenderedEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatMultilineHtml(value: string): string {
  return escapeHtml(value.trim()).replaceAll(/\r?\n/g, '<br />');
}

interface LayoutOptions {
  preheader: string;
  pageTitle: string;
  subtitle?: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  bodyHtml: string;
  securityNote?: string;
}

function renderMinrexEmailLayout(options: LayoutOptions): string {
  const year = new Date().getFullYear();
  const subtitle = options.subtitle ?? 'Ministère des Relations Extérieures · Diaspora';

  const badgeHtml = options.badgeText
    ? `
      <div style="margin-bottom: 16px;">
        <span
          style="
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            background-color: ${options.badgeBg ?? '#ecfdf5'};
            color: ${options.badgeColor ?? '#065f46'};
          "
        >
          ${escapeHtml(options.badgeText)}
        </span>
      </div>
    `
    : '';

  const securityBlock = options.securityNote
    ? `
      <tr>
        <td style="padding: 0 32px 28px;">
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
              ${escapeHtml(options.securityNote)}
            </p>
          </div>
        </td>
      </tr>
    `
    : '';

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(options.pageTitle)}</title>
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
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
      ${escapeHtml(options.preheader)}
    </div>
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
                  padding: 26px 32px;
                  text-align: center;
                "
              >
                <div
                  style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: 0.8px;
                  "
                >
                  MINREX · PNMD-CMR
                </div>
                <div
                  style="
                    margin-top: 6px;
                    font-size: 12px;
                    color: #d1fae5;
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                  "
                >
                  ${escapeHtml(subtitle)}
                </div>
              </td>
            </tr>

            <!-- BANDEAU TRICOLORE CAMEROUN -->
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="33.33%" style="height: 5px; background-color: #007a5e;"></td>
                    <td width="33.33%" style="height: 5px; background-color: #ce1126;"></td>
                    <td width="33.34%" style="height: 5px; background-color: #fcd116;"></td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CONTENU -->
            <tr>
              <td style="padding: 36px 32px 24px 32px;">
                ${badgeHtml}
                ${options.bodyHtml}
              </td>
            </tr>

            ${securityBlock}

            <!-- FOOTER INSTITUTIONNEL -->
            <tr>
              <td
                style="
                  background-color: #111827;
                  padding: 24px 32px;
                  text-align: center;
                "
              >
                <p style="margin: 0 0 6px; font-size: 13px; color: #f9fafb; font-weight: 600;">
                  Ministère des Relations Extérieures
                </p>
                <p style="margin: 0 0 10px; font-size: 12px; color: #9ca3af;">
                  République du Cameroun · Plateforme Nationale de Mobilisation de la Diaspora
                </p>
                <p style="margin: 0; font-size: 11px; color: #6b7280;">
                  Ceci est un message automatique. Merci de ne pas répondre directement à cet e-mail.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin: 18px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
            © ${year} MINREX Cameroun. Tous droits réservés.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function renderActionButton(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 26px auto;">
      <tr>
        <td align="center" bgcolor="#006b3c" style="border-radius: 8px;">
          <a
            href="${safeUrl}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-block;
              padding: 14px 28px;
              font-size: 15px;
              font-weight: 700;
              color: #ffffff;
              text-decoration: none;
              background-color: #006b3c;
              border-radius: 8px;
            "
          >
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function buildVerificationEmail(params: {
  firstName?: string | null;
  verificationLink: string;
}): RenderedEmailContent {
  const cleanName = params.firstName?.trim();
  const textGreeting = cleanName ? `Bonjour ${cleanName},` : 'Bonjour,';
  const htmlGreeting = escapeHtml(textGreeting);
  const safeLink = escapeHtml(params.verificationLink);

  const bodyHtml = `
    <h1 style="margin: 0 0 20px; font-size: 22px; line-height: 1.3; color: #111827;">
      Vérifiez votre adresse e-mail
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #374151;">
      ${htmlGreeting}
    </p>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #374151;">
      Bienvenue sur la plateforme <strong>MINREX Diaspora (PNMD-CMR)</strong>.
      Votre compte citoyen a été créé avec succès.
    </p>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #374151;">
      Pour finaliser votre inscription et activer votre espace personnel, veuillez confirmer votre adresse e-mail ci-dessous.
    </p>
    ${renderActionButton(params.verificationLink, 'Vérifier mon adresse e-mail')}
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="margin-bottom: 24px; background-color: #f9fafb; border-left: 4px solid #fcd116; border-radius: 6px;"
    >
      <tr>
        <td style="padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          Ce lien de vérification est valable pendant <strong>30 minutes</strong>.
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 13px; line-height: 1.6; color: #6b7280;">
      Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :
    </p>
    <p style="margin: 0; padding: 12px; background-color: #f3f4f6; border-radius: 6px; font-size: 12px; line-height: 1.6; color: #4b5563; word-break: break-all;">
      ${safeLink}
    </p>
  `;

  return {
    subject: 'Vérifiez votre adresse e-mail – MINREX',
    text: [
      textGreeting,
      '',
      'Bienvenue sur la plateforme MINREX Diaspora (PNMD-CMR).',
      'Votre compte citoyen a été créé avec succès.',
      '',
      'Pour finaliser votre inscription et activer votre compte, ouvrez ce lien :',
      params.verificationLink,
      '',
      'Ce lien est valable pendant 30 minutes.',
      '',
      "Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.",
      '',
      'MINREX — Ministère des Relations Extérieures · République du Cameroun',
    ].join('\n'),
    html: renderMinrexEmailLayout({
      preheader: 'Activez votre compte citoyen MINREX Diaspora (lien valable 30 minutes).',
      pageTitle: 'Vérification de votre compte MINREX',
      badgeText: 'Activation de compte',
      bodyHtml,
      securityNote:
        "Si vous n'êtes pas à l'origine de cette inscription, aucune action n'est requise : vous pouvez ignorer cet e-mail en toute sécurité.",
    }),
  };
}

export function buildNotificationEmail(params: {
  recipientName?: string | null;
  subject: string;
  title: string;
  content: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string | null;
  actionLabel?: string;
}): RenderedEmailContent {
  const cleanName = params.recipientName?.trim();
  const textGreeting = cleanName ? `Bonjour ${cleanName},` : 'Bonjour,';
  const htmlGreeting = escapeHtml(textGreeting);

  const priorityMeta: Record<string, { label: string; bg: string; color: string }> = {
    URGENT: { label: 'Alerte Urgente', bg: '#fef2f2', color: '#b91c1c' },
    HIGH: { label: 'Notification Importante', bg: '#fffbeb', color: '#b45309' },
    NORMAL: { label: 'Notification Consulaire', bg: '#ecfdf5', color: '#065f46' },
    LOW: { label: 'Information MINREX', bg: '#f3f4f6', color: '#374151' },
  };
  const badge = priorityMeta[params.priority ?? 'NORMAL'] ?? priorityMeta.NORMAL;

  const buttonHtml = params.actionUrl
    ? renderActionButton(params.actionUrl, params.actionLabel ?? 'Consulter sur le portail')
    : '';

  const bodyHtml = `
    <h1 style="margin: 0 0 18px; font-size: 20px; line-height: 1.35; color: #111827;">
      ${escapeHtml(params.title)}
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151;">
      ${htmlGreeting}
    </p>
    <div style="margin: 0 0 18px; padding: 16px 18px; background-color: #f9fafb; border-left: 4px solid #007a5e; border-radius: 6px; font-size: 15px; line-height: 1.65; color: #1f2937;">
      ${formatMultilineHtml(params.content)}
    </div>
    ${buttonHtml}
  `;

  return {
    subject: params.subject,
    text: [
      textGreeting,
      '',
      params.title,
      '',
      params.content.trim(),
      params.actionUrl ? `\nConsulter : ${params.actionUrl}` : '',
      '',
      'MINREX — Ministère des Relations Extérieures · République du Cameroun',
    ]
      .filter(Boolean)
      .join('\n'),
    html: renderMinrexEmailLayout({
      preheader: params.title,
      pageTitle: params.subject,
      badgeText: badge.label,
      badgeBg: badge.bg,
      badgeColor: badge.color,
      bodyHtml,
      securityNote:
        'Vous recevez cette alerte conformément à vos préférences de notification sur la plateforme MINREX Diaspora.',
    }),
  };
}

export function buildOtpEmail(params: {
  firstName?: string | null;
  code: string;
  purposeLabel: string;
  expiresMinutes: number;
}): RenderedEmailContent {
  const cleanName = params.firstName?.trim();
  const textGreeting = cleanName ? `Bonjour ${cleanName},` : 'Bonjour,';
  const htmlGreeting = escapeHtml(textGreeting);
  const safeCode = escapeHtml(params.code);

  const bodyHtml = `
    <h1 style="margin: 0 0 18px; font-size: 21px; line-height: 1.3; color: #111827;">
      Votre code de sécurité à usage unique
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151;">
      ${htmlGreeting}
    </p>
    <p style="margin: 0 0 22px; font-size: 15px; line-height: 1.6; color: #374151;">
      Utilisez le code ci-dessous pour finaliser : <strong>${escapeHtml(params.purposeLabel)}</strong>.
    </p>
    <div style="margin: 24px 0; padding: 20px; text-align: center; background-color: #f3f4f6; border: 1px dashed #9ca3af; border-radius: 10px;">
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #006b3c;">
        ${safeCode}
      </div>
    </div>
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="margin-bottom: 16px; background-color: #fffbeb; border-left: 4px solid #fcd116; border-radius: 6px;"
    >
      <tr>
        <td style="padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #4b5563;">
          Ce code expire dans <strong>${params.expiresMinutes} minutes</strong> et ne doit jamais être communiqué à un tiers, même se présentant comme agent consulaire.
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `${params.code} — Code de vérification MINREX`,
    text: [
      textGreeting,
      '',
      `Votre code de vérification à usage unique (${params.purposeLabel}) : ${params.code}`,
      `Ce code est valable pendant ${params.expiresMinutes} minutes.`,
      '',
      'Ne partagez jamais ce code.',
      '',
      'MINREX — Ministère des Relations Extérieures · République du Cameroun',
    ].join('\n'),
    html: renderMinrexEmailLayout({
      preheader: `Votre code à usage unique MINREX : ${params.code} (valable ${params.expiresMinutes} min).`,
      pageTitle: 'Code de vérification MINREX',
      badgeText: 'Authentification sécurisée',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      bodyHtml,
      securityNote:
        "Si vous n'avez pas demandé ce code, modifiez votre mot de passe par précaution et signalez l'activité au support MINREX.",
    }),
  };
}

export function buildConsularIdentityEmail(params: {
  firstName?: string | null;
  consularIdentifier: string;
  postName?: string | null;
  loginUrl: string;
}): RenderedEmailContent {
  const cleanName = params.firstName?.trim();
  const textGreeting = cleanName ? `Bonjour ${cleanName},` : 'Bonjour,';
  const htmlGreeting = escapeHtml(textGreeting);
  const safeId = escapeHtml(params.consularIdentifier);
  const postLine = params.postName?.trim()
    ? ` par votre poste de rattachement (<strong>${escapeHtml(params.postName.trim())}</strong>)`
    : '';

  const bodyHtml = `
    <h1 style="margin: 0 0 18px; font-size: 21px; line-height: 1.3; color: #111827;">
      Votre Identité Consulaire MINREX est validée
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151;">
      ${htmlGreeting}
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #374151;">
      Votre dossier de recensement consulaire a été approuvé${postLine}. Vous disposez désormais d'un identifiant consulaire souverain vous permettant de vous connecter via l'option <strong>« Identité consulaire »</strong> :
    </p>
    <div style="margin: 22px 0; padding: 18px; text-align: center; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 10px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #065f46; font-weight: 700; margin-bottom: 6px;">
        Matricule d'Identité Consulaire
      </div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: 700; letter-spacing: 2px; color: #064e3b;">
        ${safeId}
      </div>
    </div>
    ${renderActionButton(params.loginUrl, 'Accéder à mon espace citoyen')}
  `;

  return {
    subject: 'Validation de votre Identité Consulaire MINREX',
    text: [
      textGreeting,
      '',
      'Votre dossier de recensement consulaire a été validé.',
      `Votre identifiant consulaire officiel : ${params.consularIdentifier}`,
      '',
      `Accéder à votre espace : ${params.loginUrl}`,
      '',
      'MINREX — Ministère des Relations Extérieures · République du Cameroun',
    ].join('\n'),
    html: renderMinrexEmailLayout({
      preheader: `Votre identifiant consulaire officiel MINREX : ${params.consularIdentifier}`,
      pageTitle: 'Identité Consulaire Validée — MINREX',
      badgeText: 'KYC Consulaire Validé',
      bodyHtml,
      securityNote:
        'Conservez précieusement cet identifiant. Toute connexion par identité consulaire reste protégée par un code à usage unique.',
    }),
  };
}
