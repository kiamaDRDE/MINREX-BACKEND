
# MINREX API

Service backend de la plateforme numérique MINREX.

`minrex-api` fournit le socle backend et les API nécessaires à la
plateforme MINREX. L’application est conçue comme un backend NestJS modulaire,
avec PostgreSQL comme base de données relationnelle principale, Redis pour la
mise en cache et les traitements temporaires/distribués, et Prisma ORM pour
l’accès à la base de données.

Le projet est actuellement en cours de développement actif.

> **Important**
>
> Les spécifications fonctionnelles sont encore en cours de validation.
> Les règles métier et les modules doivent donc être implémentés progressivement
> et ne doivent pas être considérés comme définitifs tant que les exigences
> correspondantes n’ont pas été formellement approuvées.

---

## Table des matières

- [Vue d’ensemble](#vue-densemble)
- [Objectifs](#objectifs)
- [État actuel](#état-actuel)
- [Pile technologique](#pile-technologique)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Prise en main](#prise-en-main)
- [Configuration de l’environnement](#configuration-de-lenvironnement)
- [Base de données](#base-de-données)
- [Redis](#redis)
- [Exécution de l’application](#exécution-de-lapplication)
- [Documentation de l’API](#documentation-de-lapi)
- [Contrôle de santé](#contrôle-de-santé)
- [Format des réponses API](#format-des-réponses-api)
- [Journalisation et traçage des requêtes](#journalisation-et-traçage-des-requêtes)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Qualité du code](#qualité-du-code)
- [Intégration continue](#intégration-continue)
- [Workflow de développement](#workflow-de-développement)
- [Politique des modules métier](#politique-des-modules-métier)
- [Commandes utiles](#commandes-utiles)
- [Contribution](#contribution)
- [Entreprise](#entreprise)

---

# Vue d’ensemble

MINREX API est le service backend qui prend en charge la plateforme numérique
développée pour le Ministère des Relations Extérieures.

Le backend est conçu pour prendre progressivement en charge plusieurs domaines
fonctionnels, notamment la gestion des utilisateurs, le recensement de la
diaspora, la vérification, l’assistance et la protection consulaires, les talents,
le mentorat, les publications, la gestion documentaire, les notifications et le
reporting.

La phase actuelle de développement se concentre principalement sur la mise en
place d’un socle technique sécurisé, maintenable et évolutif avant l’introduction
de règles métier qui sont encore en attente de validation fonctionnelle.

---

# Objectifs

Le backend a pour objectif de fournir :

- une couche API sécurisée pour les applications web et mobiles ;
- un accès centralisé aux données de l’application ;
- des mécanismes structurés d’authentification et d’autorisation ;
- un accès fiable à la base de données ;
- la mise en cache et le support de traitements distribués ;
- la documentation de l’API ;
- une journalisation structurée et la traçabilité des requêtes ;
- des réponses de succès et d’erreur standardisées ;
- la supervision de l’état de santé du système ;
- des tests automatisés et des contrôles de qualité ;
- un socle modulaire pour les futurs modules métier.

---

# État actuel

Le socle technique comprend actuellement :

| Composant                      | État                                     |
| ------------------------------ | ----------------------------------------- |
| Application NestJS             | ✅ Prêt                                  |
| Validation de l’environnement | ✅ Prêt                                  |
| Versionnement de l’API        | ✅ Prêt                                  |
| Swagger / OpenAPI              | ✅ Prêt                                  |
| PostgreSQL                     | ✅ Prêt                                  |
| Prisma ORM                     | ✅ Prêt                                  |
| Redis                          | ✅ Prêt                                  |
| Docker Compose                 | ✅ Prêt                                  |
| Contrôles de santé           | ✅ Prêt                                  |
| Journalisation structurée     | ✅ Prêt                                  |
| Corrélation des requêtes     | ✅ Prêt                                  |
| Gestion globale des erreurs    | ✅ Prêt                                  |
| Réponses API standardisées   | ✅ Prêt                                  |
| En-têtes de sécurité Helmet | ✅ Prêt                                  |
| Configuration CORS             | ✅ Prêt                                  |
| Tests Jest                     | ✅ Prêt                                  |
| Linting                        | ✅ Prêt                                  |
| Validation du build            | ✅ Prêt                                  |
| CI GitHub                      | ✅ Prêt / En cours                       |
| Modules métier                | ⏳ En attente de validation fonctionnelle |

---

# Pile technologique

## Backend

- **Node.js 24**
- **NestJS**
- **TypeScript**

## Base de données

- **PostgreSQL 17**
- **Prisma ORM 7**

## Cache et services distribués

- **Redis 8**
- **ioredis**

## Documentation de l’API

- **Swagger**
- **OpenAPI**

## Journalisation

- **Pino**
- **nestjs-pino**

## Sécurité

- **Helmet**
- Validation de l’environnement
- Restrictions CORS
- Masquage des données sensibles dans les logs

## Tests

- **Jest**
- **ts-jest**

## Infrastructure

- **Docker**
- **Docker Compose**

## Gestionnaire de paquets

- **pnpm**

---

# Architecture

Le projet suit une architecture modulaire.

L’objectif principal est de maintenir une séparation claire entre
l’infrastructure technique et la logique métier afin que les modules
fonctionnels puissent évoluer sans créer un couplage fort dans
l’ensemble de l’application.

```text
Clients
│
├── Application Web
├── Application Mobile
└── Interfaces d’administration
        │
        ▼
┌─────────────────────────────┐
│         MINREX API          │
│                             │
│   Application NestJS        │
│                             │
│   ┌─────────────────────┐   │
│   │ Modules métier      │   │
│   └─────────────────────┘   │
│                             │
│   ┌─────────────────────┐   │
│   │ Infrastructure      │   │
│   │                     │   │
│   │ PostgreSQL          │   │
│   │ Prisma              │   │
│   │ Redis               │   │
│   │ Journalisation      │   │
│   │ Suivi de santé      │   │
│   └─────────────────────┘   │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
   PostgreSQL          Redis
```

# MINREX API

Service backend de la plateforme numérique MINREX.

`minrex-api` fournit le socle backend et les API nécessaires à la
plateforme MINREX. L’application est conçue comme un backend NestJS modulaire,
avec PostgreSQL comme base de données relationnelle principale, Redis pour la
mise en cache et les traitements temporaires/distribués, et Prisma ORM pour
l’accès à la base de données.

Le projet est actuellement en cours de développement actif.

> **Important**
>
> Les spécifications fonctionnelles sont encore en cours de validation.
> Les règles métier et les modules doivent donc être implémentés progressivement
> et ne doivent pas être considérés comme définitifs tant que les exigences
> correspondantes n’ont pas été formellement approuvées.

---

## Table des matières

- [Vue d’ensemble](#vue-densemble)
- [Objectifs](#objectifs)
- [État actuel](#état-actuel)
- [Pile technologique](#pile-technologique)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Prise en main](#prise-en-main)
- [Configuration de l’environnement](#configuration-de-lenvironnement)
- [Base de données](#base-de-données)
- [Redis](#redis)
- [Exécution de l’application](#exécution-de-lapplication)
- [Documentation de l’API](#documentation-de-lapi)
- [Contrôle de santé](#contrôle-de-santé)
- [Format des réponses API](#format-des-réponses-api)
- [Journalisation et traçage des requêtes](#journalisation-et-traçage-des-requêtes)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Qualité du code](#qualité-du-code)
- [Intégration continue](#intégration-continue)
- [Workflow de développement](#workflow-de-développement)
- [Politique des modules métier](#politique-des-modules-métier)
- [Commandes utiles](#commandes-utiles)
- [Contribution](#contribution)
- [Entreprise](#entreprise)

---

# Vue d’ensemble

MINREX API est le service backend qui prend en charge la plateforme numérique
développée pour le Ministère des Relations Extérieures.

Le backend est conçu pour prendre progressivement en charge plusieurs domaines
fonctionnels, notamment la gestion des utilisateurs, le recensement de la
diaspora, la vérification, l’assistance et la protection consulaires, les talents,
le mentorat, les publications, la gestion documentaire, les notifications et le
reporting.

La phase actuelle de développement se concentre principalement sur la mise en
place d’un socle technique sécurisé, maintenable et évolutif avant l’introduction
de règles métier qui sont encore en attente de validation fonctionnelle.

---

# Objectifs

Le backend a pour objectif de fournir :

- une couche API sécurisée pour les applications web et mobiles ;
- un accès centralisé aux données de l’application ;
- des mécanismes structurés d’authentification et d’autorisation ;
- un accès fiable à la base de données ;
- la mise en cache et le support de traitements distribués ;
- la documentation de l’API ;
- une journalisation structurée et la traçabilité des requêtes ;
- des réponses de succès et d’erreur standardisées ;
- la supervision de l’état de santé du système ;
- des tests automatisés et des contrôles de qualité ;
- un socle modulaire pour les futurs modules métier.

---

# État actuel

Le socle technique comprend actuellement :

| Composant                      | État                                     |
| ------------------------------ | ----------------------------------------- |
| Application NestJS             | ✅ Prêt                                  |
| Validation de l’environnement | ✅ Prêt                                  |
| Versionnement de l’API        | ✅ Prêt                                  |
| Swagger / OpenAPI              | ✅ Prêt                                  |
| PostgreSQL                     | ✅ Prêt                                  |
| Prisma ORM                     | ✅ Prêt                                  |
| Redis                          | ✅ Prêt                                  |
| Docker Compose                 | ✅ Prêt                                  |
| Contrôles de santé           | ✅ Prêt                                  |
| Journalisation structurée     | ✅ Prêt                                  |
| Corrélation des requêtes     | ✅ Prêt                                  |
| Gestion globale des erreurs    | ✅ Prêt                                  |
| Réponses API standardisées   | ✅ Prêt                                  |
| En-têtes de sécurité Helmet | ✅ Prêt                                  |
| Configuration CORS             | ✅ Prêt                                  |
| Tests Jest                     | ✅ Prêt                                  |
| Linting                        | ✅ Prêt                                  |
| Validation du build            | ✅ Prêt                                  |
| CI GitHub                      | ✅ Prêt / En cours                       |
| Modules métier                | ⏳ En attente de validation fonctionnelle |

---

# Pile technologique

## Backend

- **Node.js 24**
- **NestJS**
- **TypeScript**

## Base de données

- **PostgreSQL 17**
- **Prisma ORM 7**

## Cache et services distribués

- **Redis 8**
- **ioredis**

## Documentation de l’API

- **Swagger**
- **OpenAPI**

## Journalisation

- **Pino**
- **nestjs-pino**

## Sécurité

- **Helmet**
- Validation de l’environnement
- Restrictions CORS
- Masquage des données sensibles dans les logs

## Tests

- **Jest**
- **ts-jest**

## Infrastructure

- **Docker**
- **Docker Compose**

## Gestionnaire de paquets

- **pnpm**

---

# Architecture

Le projet suit une architecture modulaire.

L’objectif principal est de maintenir une séparation claire entre
l’infrastructure technique et la logique métier afin que les modules
fonctionnels puissent évoluer sans créer un couplage fort dans
l’ensemble de l’application.

```text
Clients
│
├── Application Web
├── Application Mobile
└── Interfaces d’administration
        │
        ▼
┌─────────────────────────────┐
│         MINREX API          │
│                             │
│   Application NestJS        │
│                             │
│   ┌─────────────────────┐   │
│   │ Modules métier      │   │
│   └─────────────────────┘   │
│                             │
│   ┌─────────────────────┐   │
│   │ Infrastructure      │   │
│   │                     │   │
│   │ PostgreSQL          │   │
│   │ Prisma              │   │
│   │ Redis               │   │
│   │ Journalisation      │   │
│   │ Suivi de santé      │   │
│   └─────────────────────┘   │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
   PostgreSQL          Redis
```

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Logo Nest" /></a>
</p>

<p align="center">Un framework <a href="http://nodejs.org" target="_blank">Node.js</a> progressif permettant de construire des applications serveur efficaces et évolutives.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="Version NPM" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Licence du paquet" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="Téléchargements NPM" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Contributeurs sur Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors sur Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Faire un don"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Nous soutenir"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Nous suivre sur Twitter"></a>
</p>
  <!--[![Contributeurs sur Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors sur Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Dépôt de démarrage TypeScript du framework [Nest](https://github.com/nestjs/nest).

## Configuration du projet

```bash
$ pnpm install
```

## Compiler et exécuter le projet

```bash
# développement
$ pnpm run start

# mode surveillance
$ pnpm run start:dev

# mode production
$ pnpm run start:prod
```

## Exécuter les tests

```bash
# tests unitaires
$ pnpm run test

# tests e2e
$ pnpm run test:e2e

# couverture de tests
$ pnpm run test:cov
```

## Déploiement

Lorsque vous êtes prêt à déployer votre application NestJS en production,
plusieurs étapes importantes permettent de garantir un fonctionnement aussi
efficace que possible. Consultez la
[documentation sur le déploiement](https://docs.nestjs.com/deployment) pour
plus d’informations.

Si vous recherchez une plateforme cloud pour déployer votre application
NestJS, consultez [Mau](https://mau.nestjs.com), notre plateforme officielle
de déploiement des applications NestJS sur AWS. Mau permet un déploiement
simple et rapide en quelques étapes :

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

Avec Mau, vous pouvez déployer votre application en quelques clics et vous
concentrer sur le développement des fonctionnalités plutôt que sur la gestion
de l’infrastructure.

## Observabilité

Dans les applications de production, l’observabilité est essentielle pour
comprendre le comportement du système, détecter rapidement les problèmes et
maintenir des performances fiables.

[NestJS Observe](https://observe.nestjs.com) instrumente automatiquement votre
application NestJS et offre une visibilité approfondie sur le système avec une
configuration minimale :

- **Traçage distribué :** suivre les requêtes entre les services et comprendre leur cheminement dans le système.
- **Analyse en cascade :** visualiser l’exécution des requêtes et identifier les opérations lentes, les goulots d’étranglement et les délais inattendus.
- **Analyse des performances :** analyser les performances de l’application en temps réel et identifier rapidement les zones à optimiser.
- **Métriques :** suivre les indicateurs clés de l’application et de l’infrastructure pour comprendre l’état de santé et les tendances de performance.
- **Journalisation :** centraliser et corréler les logs avec les traces et les autres données de télémétrie afin de faciliter le débogage.
- **Suivi des erreurs :** détecter rapidement les erreurs et analyser leur cause racine avec le contexte associé.
- **Suivi des SLA :** suivre les objectifs de niveau de service et détecter lorsque l’application approche ou dépasse les seuils définis.
- **Alarmes et alertes :** configurer des alertes pour les erreurs critiques, les dégradations de performance, les violations de SLA et d’autres anomalies afin de permettre une réaction rapide de l’équipe.

Ce projet est déjà instrumenté. Créez un compte gratuit sur
[observe.nestjs.com](https://observe.nestjs.com), ajoutez une application,
puis insérez la clé d’application et le secret générés dans l’appel
`ObserveModule.forRoot()` du fichier `src/app.module.ts`.

L’offre gratuite ne nécessite aucune information de paiement et couvre
300 000 événements par mois. Vous pouvez également consulter la
[démonstration en direct](https://www.observe-demo.nestjs.com/dashboard) :
elle présente un tableau de bord complet basé sur les données d’un service
actif, sans aucune installation.

## Ressources

Voici quelques ressources utiles pour travailler avec NestJS :

- Consultez la [documentation NestJS](https://docs.nestjs.com) pour en savoir plus sur le framework.
- Pour les questions et le support, consultez notre [canal Discord](https://discord.gg/G7Qnnhy).
- Pour approfondir vos connaissances avec davantage de pratique, consultez nos [cours vidéo officiels](https://courses.nestjs.com/).
- Déployez votre application sur AWS en quelques clics avec [NestJS Mau](https://mau.nestjs.com).
- Instrumentez automatiquement votre application avec [NestJS Observe](https://observe.nestjs.com) : traçage distribué, métriques, journalisation, suivi des erreurs et performances.
- Visualisez le graphe de votre application et interagissez avec l’application NestJS en temps réel grâce à [NestJS Devtools](https://devtools.nestjs.com).
- Besoin d’aide sur votre projet, à temps partiel ou à temps plein ? Consultez le [support entreprise officiel](https://enterprise.nestjs.com).
- Pour suivre les actualités et mises à jour, suivez-nous sur [X](https://x.com/nestframework) et [LinkedIn](https://linkedin.com/company/nestjs).
- Vous cherchez un emploi ou souhaitez publier une offre ? Consultez le [tableau des offres d’emploi officiel](https://jobs.nestjs.com).

## Support

Nest est un projet open source sous licence MIT. Il peut évoluer grâce aux
sponsors et au soutien de ses contributeurs. Si vous souhaitez les rejoindre,
[consultez cette page](https://docs.nestjs.com/support).

## Rester en contact

- Auteur - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Site web - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## Licence

Nest est distribué sous [licence MIT](https://github.com/nestjs/nest/blob/master/LICENSE).

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest
