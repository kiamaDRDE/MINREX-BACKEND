import { AssistanceUrgency } from '../../../generated/prisma/enums.js';

export interface DefaultProtocolStepDefinition {
  stepNumber: number;
  title: string;
  description: string;
  recommendedDelay: string;
  responsibleRole: string;
  requiredDocs: string[];
}

export interface DefaultProtocolDefinition {
  code: string;
  name: string;
  shortName: string;
  categoryGroup:
    | 'Urgence & Détresse'
    | 'Aide Sociale & Financière'
    | 'Protection Spéciale';
  description: string;
  legalNotice: string;
  icon: string;
  badgeColor: string;
  defaultUrgency: AssistanceUrgency;
  defaultSlaHours: number;
  displayOrder: number;
  steps: DefaultProtocolStepDefinition[];
}

export const DEFAULT_LEGAL_NOTICE =
  "Conformément à la Convention de Vienne sur les relations consulaires, les services diplomatiques et consulaires accompagnent et protègent les ressortissants camerounais en situation de détresse avérée. Les frais privés (honoraires d'avocat, pompes funèbres, vols sanitaires) relèvent des assurances ou des familles, sauf dispositif exceptionnel d'aide sociale validé en commission.";

export const DEFAULT_ASSISTANCE_PROTOCOLS: readonly DefaultProtocolDefinition[] = [
  {
    code: 'ARRESTATION',
    name: "En cas d'arrestation ou de détention",
    shortName: 'Arrestation & Détention',
    categoryGroup: 'Urgence & Détresse',
    description:
      "Garantir le respect des droits fondamentaux (Art. 36 Convention de Vienne), les visites consulaires et l'orientation juridique.",
    legalNotice:
      "Article 36 de la Convention de Vienne : tout ressortissant camerounais détenu à l'étranger a le droit d'exiger la notification immédiate de son Consulat et de recevoir une visite consulaire.",
    icon: '🚨',
    badgeColor: 'bg-red-600 text-white',
    defaultUrgency: AssistanceUrgency.CRITICAL,
    defaultSlaHours: 4,
    displayOrder: 1,
    steps: [
      {
        stepNumber: 1,
        title: 'Notification & Alerte consulaire',
        description:
          'Les autorités locales informent le consulat ou le détenu/un proche transmet un signalement prioritaire.',
        recommendedDelay: '< 4h',
        responsibleRole: "Cellule d'astreinte consulaire",
        requiredDocs: ['Avis de détention (si disponible)', 'Identité du proche signalant'],
      },
      {
        stepNumber: 2,
        title: 'Visite consulaire',
        description:
          "Un agent consulaire se rend sur place pour vérifier les conditions de détention et l'intégrité physique du ressortissant.",
        recommendedDelay: '< 24h',
        responsibleRole: 'Agent consulaire de permanence',
        requiredDocs: [],
      },
      {
        stepNumber: 3,
        title: 'Orientation juridique',
        description:
          "Remise de la liste d'avocats locaux agréés et vérification de l'accès à un interprète si nécessaire.",
        recommendedDelay: '< 48h',
        responsibleRole: 'Service juridique du poste',
        requiredDocs: ["Copie pièce d'identité camerounaise"],
      },
      {
        stepNumber: 4,
        title: 'Suivi & Liaison familiale',
        description:
          'Notification de la famille (avec accord du détenu) et suivi régulier de la procédure judiciaire.',
        recommendedDelay: 'Continu',
        responsibleRole: 'Chef de section consulaire',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'ACCIDENT_MALADIE',
    name: "En cas d'accident grave ou de maladie",
    shortName: 'Accident grave ou Maladie',
    categoryGroup: 'Urgence & Détresse',
    description:
      "Coordination hospitalière, liaison avec l'assurance et appui au rapatriement sanitaire.",
    legalNotice: DEFAULT_LEGAL_NOTICE,
    icon: '🏥',
    badgeColor: 'bg-rose-600 text-white',
    defaultUrgency: AssistanceUrgency.CRITICAL,
    defaultSlaHours: 6,
    displayOrder: 2,
    steps: [
      {
        stepNumber: 1,
        title: 'Signalement médical',
        description:
          "L'hôpital, les secours locaux ou un proche préviennent les services consulaires de la situation.",
        recommendedDelay: '< 2h',
        responsibleRole: "Cellule d'urgence médicale",
        requiredDocs: ["Coordonnées de l'établissement hospitalier"],
      },
      {
        stepNumber: 2,
        title: 'Vérification & Contact praticiens',
        description:
          "L'agent valide la situation médicale et établit le contact direct avec l'équipe soignante.",
        recommendedDelay: '< 6h',
        responsibleRole: 'Médecin conseil / Agent consulaire',
        requiredDocs: [],
      },
      {
        stepNumber: 3,
        title: 'Liaison assurance & famille',
        description:
          "Information de la famille au Cameroun et coordination avec la compagnie d'assurance voyage.",
        recommendedDelay: '< 12h',
        responsibleRole: 'Section affaires sociales',
        requiredDocs: ["Attestation d'assurance voyage (si applicable)"],
      },
      {
        stepNumber: 4,
        title: 'Appui au rapatriement sanitaire',
        description:
          "Appui administratif et autorisations consulaires pour l'organisation d'un vol médicalisé si requis.",
        recommendedDelay: '< 48h',
        responsibleRole: 'Consul / Chef de poste',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'DECES',
    name: "En cas de décès à l'étranger",
    shortName: "Décès à l'étranger",
    categoryGroup: 'Urgence & Détresse',
    description:
      'Formalités administratives de transport de corps ou cendres, scellés consulaires et coordination avec la famille.',
    legalNotice: DEFAULT_LEGAL_NOTICE,
    icon: '🕊️',
    badgeColor: 'bg-slate-700 text-white',
    defaultUrgency: AssistanceUrgency.HIGH,
    defaultSlaHours: 24,
    displayOrder: 3,
    steps: [
      {
        stepNumber: 1,
        title: 'Déclaration officielle du décès',
        description:
          'Réception de la notification officielle du décès via les autorités locales, la famille ou les pompes funèbres.',
        recommendedDelay: '< 12h',
        responsibleRole: 'Section état civil & décès',
        requiredDocs: ['Certificat de décès local'],
      },
      {
        stepNumber: 2,
        title: 'Formalités de transport & Scellés',
        description:
          "Délivrance du laissez-passer mortuaire / autorisation de transport et apposition des scellés consulaires.",
        recommendedDelay: '< 48h',
        responsibleRole: 'Agent consulaire habilité',
        requiredDocs: ['Acte de naissance ou passeport du défunt', 'Accord familial'],
      },
      {
        stepNumber: 3,
        title: 'Coordination du rapatriement ou inhumation',
        description:
          "Liaison avec les opérateurs funéraires et la famille pour le rapatriement de la dépouille ou l'inhumation locale.",
        recommendedDelay: '< 5 jours',
        responsibleRole: 'Consul & Famille',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'CRISE_MAJEURE',
    name: 'En cas de crise majeure (guerre, catastrophe, attentat)',
    shortName: 'Crise majeure & Évacuation',
    categoryGroup: 'Urgence & Détresse',
    description:
      'Activation de la cellule de crise, recensement des ressortissants en zone sinistrée, consignes de sécurité et évacuation.',
    legalNotice:
      "En situation de crise majeure, la priorité absolue est donnée à la localisation et à la mise en sécurité des ressortissants immatriculés au registre consulaire (MRD).",
    icon: '🌪️',
    badgeColor: 'bg-orange-600 text-white',
    defaultUrgency: AssistanceUrgency.CRITICAL,
    defaultSlaHours: 1,
    displayOrder: 4,
    steps: [
      {
        stepNumber: 1,
        title: 'Alerte & Cellule de crise',
        description:
          'Déclenchement immédiat de la cellule de crise consulaire et liaison directe avec le MINREX à Yaoundé.',
        recommendedDelay: 'Immédiat (< 1h)',
        responsibleRole: 'Ambassadeur / Chef de mission',
        requiredDocs: [],
      },
      {
        stepNumber: 2,
        title: "Recensement d'urgence",
        description:
          'Localisation et décompte des ressortissants camerounais dans la zone affectée.',
        recommendedDelay: '< 6h',
        responsibleRole: 'Équipe cellule de crise',
        requiredDocs: ['Localisation précise ou zone de présence'],
      },
      {
        stepNumber: 3,
        title: 'Consignes de sécurité',
        description:
          'Diffusion en temps réel des consignes de confinement, points de rassemblement et itinéraires sécurisés.',
        recommendedDelay: 'En continu',
        responsibleRole: 'Attaché de sécurité / Poste',
        requiredDocs: [],
      },
      {
        stepNumber: 4,
        title: 'Évacuation sécurisée',
        description:
          "Coordination interministérielle et logistique des convois ou vols d'évacuation vers une zone sûre.",
        recommendedDelay: 'Selon plan de crise',
        responsibleRole: 'Coordination MINREX',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'DISPARITION',
    name: 'En cas de disparition inquiétante',
    shortName: 'Disparition inquiétante',
    categoryGroup: 'Protection Spéciale',
    description:
      'Saisine consulaire officielle, relais auprès des autorités policières locales et restitution vérifiée aux proches.',
    legalNotice: DEFAULT_LEGAL_NOTICE,
    icon: '🔍',
    badgeColor: 'bg-indigo-600 text-white',
    defaultUrgency: AssistanceUrgency.HIGH,
    defaultSlaHours: 12,
    displayOrder: 5,
    steps: [
      {
        stepNumber: 1,
        title: 'Saisine du consulat',
        description:
          'La famille déclare la disparition aux autorités locales et saisit parallèlement les services consulaires.',
        recommendedDelay: '< 6h',
        responsibleRole: 'Section protection consulaire',
        requiredDocs: ['Déclaration de disparition locale (si déjà déposée)'],
      },
      {
        stepNumber: 2,
        title: 'Relais policier local',
        description:
          "Le consulat transmet une démarche officielle de recherche auprès des forces de police du pays d'accueil.",
        recommendedDelay: '< 24h',
        responsibleRole: 'Agent de liaison consulaire',
        requiredDocs: [],
      },
      {
        stepNumber: 3,
        title: 'Suivi des investigations',
        description:
          'Échanges réguliers avec les enquêteurs locaux pour suivre les avis de recherche et vérifications.',
        recommendedDelay: 'Hebdomadaire',
        responsibleRole: 'Agent consulaire',
        requiredDocs: [],
      },
      {
        stepNumber: 4,
        title: 'Restitution aux proches',
        description:
          'Communication confidentielle des informations vérifiées à la famille ou aux représentants désignés.',
        recommendedDelay: 'Dès résultat',
        responsibleRole: 'Chef de section consulaire',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'PERTE_DOCUMENTS',
    name: "En cas de vol ou perte de documents (procédure d'urgence)",
    shortName: 'Vol / Perte de documents',
    categoryGroup: 'Urgence & Détresse',
    description:
      "Délivrance rapide d'un laissez-passer consulaire de retour ou d'un titre de voyage d'urgence après contrôle d'identité.",
    legalNotice:
      "Un laissez-passer consulaire est délivré pour un retour direct au Cameroun après vérification d'identité et présentation de la déclaration de perte ou de vol.",
    icon: '🛂',
    badgeColor: 'bg-blue-600 text-white',
    defaultUrgency: AssistanceUrgency.HIGH,
    defaultSlaHours: 24,
    displayOrder: 6,
    steps: [
      {
        stepNumber: 1,
        title: 'Déclaration de perte ou vol',
        description:
          'Déclaration aux forces de police locales afin de disposer du récépissé officiel de perte ou de vol.',
        recommendedDelay: 'Préalable',
        responsibleRole: 'Demandeur',
        requiredDocs: ['Récépissé de déclaration de police'],
      },
      {
        stepNumber: 2,
        title: "Rendez-vous d'urgence consulaire",
        description:
          "Accueil prioritaire au poste diplomatique ou consulaire avec justificatifs d'identité disponibles.",
        recommendedDelay: '< 24h',
        responsibleRole: "Guichet d'urgence consulaire",
        requiredDocs: ["2 photos d'identité", "Copie ancien passeport ou acte de naissance"],
      },
      {
        stepNumber: 3,
        title: "Vérification d'identité",
        description:
          "Contrôle sécurisé de l'identité et de la nationalité dans les registres consulaires MINREX.",
        recommendedDelay: '< 4h',
        responsibleRole: 'Section passeports & titres',
        requiredDocs: [],
      },
      {
        stepNumber: 4,
        title: 'Délivrance du titre de voyage',
        description:
          "Remise du laissez-passer de retour direct au Cameroun ou du titre de voyage d'urgence.",
        recommendedDelay: 'Le jour même',
        responsibleRole: 'Consul / Vice-Consul',
        requiredDocs: [],
      },
    ],
  },
  {
    code: 'SECOURS_URGENCE',
    name: "Secours occasionnels d'urgence (aides sociales et financières)",
    shortName: "Secours social d'urgence",
    categoryGroup: 'Aide Sociale & Financière',
    description:
      "Évaluation de la situation d'indigence avérée, examen en comité consulaire et accompagnement social ponctuel.",
    legalNotice:
      "Les secours occasionnels d'urgence sont strictement encadrés, exceptionnels et accordés sur décision de la commission sociale consulaire dans la limite des crédits disponibles.",
    icon: '💶',
    badgeColor: 'bg-emerald-600 text-white',
    defaultUrgency: AssistanceUrgency.NORMAL,
    defaultSlaHours: 72,
    displayOrder: 7,
    steps: [
      {
        stepNumber: 1,
        title: 'Évaluation sociale',
        description:
          "Entretien avec la section affaires sociales du consulat pour évaluer la situation d'extrême vulnérabilité.",
        recommendedDelay: '< 48h',
        responsibleRole: 'Assistant social consulaire',
        requiredDocs: [],
      },
      {
        stepNumber: 2,
        title: 'Constitution du dossier social',
        description:
          'Rassemblement des éléments justifiant la rupture de ressources ou la dépense vitale urgente.',
        recommendedDelay: '< 3 jours',
        responsibleRole: 'Demandeur & Travailleur social',
        requiredDocs: ['Justificatif de situation de vulnérabilité (si disponible)'],
      },
      {
        stepNumber: 3,
        title: "Commission d'attribution",
        description:
          "Examen collégial du dossier par le comité consulaire d'attribution des secours occasionnels.",
        recommendedDelay: 'Sous 5 jours',
        responsibleRole: 'Comité social consulaire',
        requiredDocs: [],
      },
      {
        stepNumber: 4,
        title: 'Versement & Clôture',
        description:
          'Déblocage du secours (paiement direct au prestataire ou au bénéficiaire selon décision de la commission).',
        recommendedDelay: '< 24h post-décision',
        responsibleRole: 'Régisseur consulaire',
        requiredDocs: [],
      },
    ],
  },
];
