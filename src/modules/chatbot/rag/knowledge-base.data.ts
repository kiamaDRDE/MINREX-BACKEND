export interface ApprovedDocument {
  id: string;
  category:
    | 'RECENSEMENT'
    | 'PASSEPORT'
    | 'ASSISTANCE_URGENCE'
    | 'ASSOCIATIONS'
    | 'PUBLICATIONS'
    | 'ETAT_CIVIL';
  title: string;
  reference: string;
  updatedAt: string;
  keywords: string[];
  summary: string;
  content: string;
  officialLink?: string;
}

export const APPROVED_MINREX_DOCUMENTS: ApprovedDocument[] = [
  {
    id: 'doc-recensement-01',
    category: 'RECENSEMENT',
    title: 'Guide Officiel du Recensement et de la Carte Consulaire',
    reference: 'Décret N° 2013/112 & Circulaire MINREX 2026/01',
    updatedAt: '2026-01-15',
    keywords: [
      'recensement',
      'immatriculation',
      'carte consulaire',
      'inscription',
      'délai',
      'gratuit',
      'pièces',
      'renouvellement',
    ],
    summary:
      'Procédure d’enregistrement obligatoire de tout citoyen camerounais résidant à l’étranger auprès de sa juridiction consulaire.',
    content: `L'immatriculation consulaire est un devoir régalien et un droit fondamental pour tout ressortissant camerounais à l'étranger.
Frais : L'immatriculation consulaire et la délivrance de la première carte consulaire sont ENTIÈREMENT GRATUITES.
Pièces exigées :
1. Une preuve de nationalité camerounaise (Passeport en cours ou périmé, Acte de naissance certifié conforme ou CNI).
2. Un titre de séjour régulier dans le pays d'accueil (ou visa en cours de validité).
3. Un justificatif de domicile récent (quittance de loyer, facture d'électricité ou attestation d'hébergement).
4. Deux photos d'identité récentes format passeport.
Validité : La carte consulaire délivrée est valable pour une durée de 3 (trois) ans renouvelable.
Délai moyen d'instruction : 48h à 5 jours ouvrés à compter de la soumission du dossier complet.`,
    officialLink: '/espace/recensement',
  },
  {
    id: 'doc-passeport-02',
    category: 'PASSEPORT',
    title: 'Dispositions Relatives aux Passeports Biométriques et Laissez-Passer',
    reference: 'Décret présidentiel N° 2021/347 & Barème de Chancellerie',
    updatedAt: '2026-02-01',
    keywords: [
      'passeport',
      'biométrique',
      'enrôlement',
      'timbre',
      'prix',
      'laissez-passer',
      'perte',
      'vol',
      'tarif',
    ],
    summary:
      'Conditions de délivrance des passeports biométriques camerounais et des laissez-passer d’urgence en cas de perte ou de vol.',
    content: `Procédure de demande de passeport ordinaire biométrique :
1. Pré-enrôlement en ligne obligatoire sur la plateforme officielle (DGSN / PassCam).
2. Paiement des droits de timbre officiels fixés à 110 000 FCFA (ou contre-valeur de chancellerie homologuée).
3. Rendez-vous physique au centre d'enrôlement de l'Ambassade ou du Consulat Général pour la prise d'empreintes digitales et photographie biométrique.
En cas de perte ou de vol à l'étranger :
- Déclaration de perte obligatoire auprès des services de police locaux.
- Présentation de la déclaration de perte au consulat.
- Pour un retour d'urgence au Cameroun sans passeport : délivrance d'un Laissez-Passer Consulaire (Emergency Travel Document), valable 30 jours, strictement réservé au voyage direct vers le territoire camerounais.`,
    officialLink: '/espace/documents',
  },
  {
    id: 'doc-urgence-arrestation-03',
    category: 'ASSISTANCE_URGENCE',
    title: 'Protocole de Protection Consulaire en Cas d’Arrestation ou Détention',
    reference: 'Convention de Vienne de 1963 (Art. 36) & Code Consulaire MINREX',
    updatedAt: '2026-01-20',
    keywords: [
      'arrestation',
      'police',
      'garde à vue',
      'prison',
      'avocat',
      'détention',
      'urgence',
      'secours',
    ],
    summary:
      'Garantie des droits républicains et assistance diplomatique immédiate en cas d’interpellation par les autorités locales étrangères.',
    content: `Droits du ressortissant camerounais interpellé à l'étranger :
Conformément à l'article 36 de la Convention de Vienne sur les relations consulaires de 1963 :
1. Vous avez le droit absolu d'exiger des autorités policières ou judiciaires locales qu'elles informent sans délai le Consulat ou l'Ambassade du Cameroun.
2. Tout citoyen retenu a le droit de communiquer librement avec les agents consulaires camerounais.
Rôle du Consulat :
- Vérifier les conditions légales de détention et le respect de l'intégrité physique.
- Faciliter la mise en relation avec un avocat agréé ou l'aide juridictionnelle locale.
- Prévenir la famille au Cameroun ou à l'étranger avec l'accord formel du citoyen.
Important : L'autorité consulaire ne peut se substituer à la justice locale ni payer les cautions ou amendes personnelles.`,
    officialLink: '/espace/assistance',
  },
  {
    id: 'doc-urgence-deces-04',
    category: 'ASSISTANCE_URGENCE',
    title: 'Protocole Régalien en Cas de Décès et Rapatriement de Dépouille',
    reference: 'Arrêté conjoint MINREX/MINSANTE & Réglementation Sanitaire IATA',
    updatedAt: '2026-02-10',
    keywords: [
      'décès',
      'mort',
      'rapatriement',
      'corps',
      'dépouille',
      'morgue',
      'laissez-passer mortuaire',
    ],
    summary:
      'Formalités administratives et sanitaires obligatoires pour le rapatriement ou l’inhumation d’un compatriote décédé à l’étranger.',
    content: `Démarches prioritaires lors du décès d'un citoyen camerounais à l'étranger :
1. Constat de décès et déclaration auprès de l'état civil de la mairie locale.
2. Signalement immédiat au Consulat compétent pour l'ouverture du dossier de protection mortuaire.
Documents délivrés par le Consulat :
- Transcription consulaire de l'acte de décès.
- Laissez-passer mortuaire officiel et certificat de mise en bière hermétique (scellé consulaire conforme aux normes IATA pour le transport aérien).
- Autorisation de transport de dépouille vers le Cameroun.
Accompagnement : Les agents consulaires orientent les familles vers les compagnies habilitées et les mutuelles de la diaspora camerounaise.`,
    officialLink: '/espace/assistance',
  },
  {
    id: 'doc-associations-05',
    category: 'ASSOCIATIONS',
    title: 'Procédure d’Homologation et d’Agrément des Associations (MCA)',
    reference: 'Circulaire Ministérielle MINREX/DCE/2026 N° 04',
    updatedAt: '2026-03-01',
    keywords: [
      'association',
      'homologation',
      'agrément',
      'statuts',
      'communauté',
      'bureau',
      'répertoire',
      'diaspora',
    ],
    summary:
      'Modalités d’enregistrement et de certification officielle des organisations de la diaspora auprès des postes diplomatiques.',
    content: `L'État du Cameroun reconnaît et valorise le tissu associatif de la diaspora à travers le Module Cartographie & Agrément des Associations (MCA).
Conditions d'éligibilité :
- Être une organisation légalement constituée dans le pays de résidence (récépissé préfectoral ou équivalent local).
- Poursuivre des buts non lucratifs (solidarité, développement, culture, éducation, sport).
Pièces à téléverser sur la plateforme :
1. Statuts officiels signés et certifiés.
2. Récépissé de déclaration auprès des autorités locales.
3. Procès-verbal de l'Assemblée générale constitutive ou de renouvellement du bureau.
4. Liste nominative des membres du bureau exécutif (Président, Secrétaire, Trésorier).
Circuit d'instruction :
- Dépôt en ligne sur /espace/associations.
- Instruction de conformité par l'Agent Consulaire.
- Homologation souveraine et attribution du Numéro d'Accréditation d'État par le Chef de Poste diplomatique.
- Délivrance de l'Attestation Officielle d'Homologation et publication à l'Annuaire National des Associations.`,
    officialLink: '/espace/associations',
  },
  {
    id: 'doc-etat-civil-06',
    category: 'ETAT_CIVIL',
    title: 'Transcription des Actes d’État Civil (Naissance et Mariage)',
    reference: 'Ordonnance N° 81-02 portant organisation de l’état civil',
    updatedAt: '2026-01-10',
    keywords: [
      'acte de naissance',
      'mariage',
      'transcription',
      'état civil',
      'légalisation',
      'enfant',
    ],
    summary:
      'Règles de transcription des actes d’état civil établis par les autorités étrangères sur les registres consulaires camerounais.',
    content: `Tout événement d'état civil survenu à l'étranger concernant un citoyen camerounais doit être transcrit sur les registres de l'Ambassade ou du Consulat compétent.
Transcription de naissance :
- Doit être sollicitée dans un délai recommandé de 90 jours suivant la naissance.
- Pièces : Copie intégrale de l'acte de naissance étranger apostillé ou légalisé, preuves de nationalité camerounaise des parents, acte de mariage des parents ou acte de reconnaissance.
Transcription de mariage :
- Obligatoire pour conférer les effets civils au Cameroun.
- Pièces : Extrait d'acte de mariage étranger, copies d'actes de naissance des époux et passeports.`,
    officialLink: '/espace/documents',
  },
];

