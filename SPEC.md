# SPEC.md — AcademyFlow

Spécification fonctionnelle — Source de vérité pour les agents de développement.
Ce document ne contient aucune décision technologique. Il décrit uniquement le QUOI, POUR QUI, POURQUOI et COMMENT vérifier.

---

## 1. Vision du produit

**Résumé.** AcademyFlow est un logiciel desktop destiné aux écoles primaires et secondaires privées du Bénin. Il remplace les cahiers papier utilisés pour les inscriptions et la gestion financière par un système numérique centralisé, traçable et sécurisé.

**Problème.** Les écoles gèrent aujourd'hui les inscriptions et les paiements sur papier : saisie manuelle, reçus manuscrits, information dispersée, risque de perte de données, rapports financiers longs à produire, faible traçabilité.

**Solution proposée.** Un logiciel installé sur un poste de l'établissement qui centralise le dossier des élèves, enregistre toutes les opérations de caisse, imprime automatiquement des reçus, et génère les documents administratifs et financiers courants.

**Valeur apportée.** Gain de temps administratif, réduction des erreurs de saisie, traçabilité complète des opérations financières, sécurisation des données scolaires, image plus professionnelle de l'établissement auprès des parents.

---

## 2. Objectifs

**Objectifs principaux**
- Numériser les inscriptions des élèves.
- Numériser les opérations de caisse (recettes et dépenses).
- Automatiser la génération et l'impression des reçus de paiement.
- Assurer le suivi individuel des frais de scolarité par élève.
- Produire automatiquement les rapports financiers (journaliers, mensuels, annuels).

**Objectifs secondaires**
- Gérer le personnel de l'établissement et le paiement des salaires.
- Générer automatiquement les documents administratifs (certificat de scolarité, attestation d'inscription, fiche élève, etc.).
- Assurer la traçabilité de toutes les opérations (qui a fait quoi, quand).

**Indicateurs de réussite**
- Réduction mesurable du temps nécessaire pour enregistrer une inscription ou un paiement par rapport au processus papier.
- Réduction du nombre d'erreurs de caisse constatées lors des contrôles.
- Disponibilité immédiate d'un rapport financier à jour, sans reconstruction manuelle.
- Adoption effective par le personnel administratif (abandon progressif des cahiers).

---

## 3. Utilisateurs et acteurs

| Acteur | Rôle | Statut |
|---|---|---|
| Administrateur / Direction | Supervision globale, accès à tous les modules et rapports, configuration de l'établissement | Utilisateur du logiciel |
| Agent d'inscription / Secrétariat | Inscription des élèves, gestion des dossiers, génération des documents administratifs | Utilisateur du logiciel |
| Caissier / Agent de caisse | Enregistrement des paiements et dépenses, impression des reçus | Utilisateur du logiciel |
| Gestionnaire du personnel (peut être la même personne que l'administrateur) | Gestion des employés et des salaires | Utilisateur du logiciel |
| Parent / Tuteur | Bénéficiaire indirect : effectue le paiement physiquement au guichet et reçoit le reçu imprimé | N'utilise pas le logiciel |
| Élève | Sujet des dossiers gérés par le logiciel | N'utilise pas le logiciel |

> **Décision confirmée :** pour le MVP, le logiciel ne différencie pas les droits d'accès par rôle. Un seul type de compte utilisateur existe, avec accès complet à l'ensemble des modules et fonctionnalités. Les acteurs listés ci-dessus (Agent d'inscription, Caissier, Gestionnaire du personnel, etc.) décrivent qui effectue une action dans le processus de l'établissement, mais ne correspondent à aucune restriction technique de permission dans le système. Une gestion différenciée des rôles pourra être envisagée en évolution future (voir section 15).

---

## 4. Périmètre

### MVP (périmètre minimal viable)
- Module Élèves : inscription, modification, suppression, recherche, passage en classe supérieure, redoublement, liste par classe.
- Module Caisse : enregistrement des entrées et sorties, journal de caisse, compte de scolarité individuel, consultation des soldes/arriérés.
- Système de reçus automatiques (génération et impression au moment du paiement).
- Génération des documents élève de base : attestation d'inscription, certificat de scolarité, fiche individuelle, liste de classe (PDF).
- Rapports financiers journaliers, mensuels, annuels.
- Tableau de bord financier simple.
- Module Personnel simplifié : enregistrement des employés avec salaire mensuel, marquage mensuel du paiement du salaire, état des paiements du mois.
- Module Paramètres : configuration de l'année scolaire en cours et du barème des frais de scolarité par classe (tranches et échéances).

### Post-MVP
- Module Personnel complet (avances, retenues, primes, contrats, documents RH avancés).
- Historique détaillé du parcours scolaire d'un élève sur plusieurs années.
- Tableau de bord avancé avec indicateurs multiples.

### Hors périmètre
- Tout paiement électronique ou en ligne : le logiciel n'est **pas** un moyen de paiement, il enregistre uniquement des paiements effectués physiquement au guichet.
- Portail parent (consultation à distance par les parents) — non mentionné dans l'idée source.
- Gestion pédagogique (notes, emplois du temps, bulletins scolaires) — non mentionnée dans l'idée source.
- Gestion multi-établissements dans une même instance : le logiciel étant une application desktop installée localement et fonctionnant hors ligne, chaque installation correspond à un seul établissement scolaire.

---

## 5. Fonctionnalités

### Module Élèves

**F-001 — Inscription d'un nouvel élève**
- Acteur : Agent d'inscription.
- Préconditions : aucune fiche existante pour cet élève pour l'année scolaire en cours.
- Comportement : saisie des informations de l'élève et du responsable, attribution automatique d'un numéro matricule unique, enregistrement de la fiche dans le système.
- Règles associées : BR-001, BR-002.
- Cas particuliers : élève venant d'une autre école (transfert) — le champ « école de provenance » doit être renseigné.
- Critères d'acceptation :
  - Une fiche élève ne peut être créée sans les champs obligatoires définis en section 8 (Données fonctionnelles).
  - Un matricule est généré automatiquement, est unique dans tout le système, et n'est jamais modifiable manuellement.
  - Une fois l'inscription validée, l'élève est immédiatement disponible dans les recherches et dans le module Caisse.

**F-002 — Modification des informations d'un élève**
- Acteur : Agent d'inscription / Administrateur.
- Préconditions : l'élève existe dans la base.
- Comportement : mise à jour des champs administratifs de la fiche élève.
- Cas particuliers : le matricule ne peut jamais être modifié.
- Critères d'acceptation : toute modification est horodatée et attribuable à l'utilisateur qui l'a effectuée (traçabilité).

**F-003 — Suppression d'un élève**
- Acteur : Administrateur.
- Préconditions : l'élève existe dans la base.
- Comportement : retrait de la fiche du dossier actif.
- Cas particuliers : un élève ayant des opérations de caisse enregistrées ne doit pas voir son historique financier disparaître.
- Critères d'acceptation : la suppression d'un élève ayant un historique de paiement conserve cet historique (voir BR-006) ; l'action nécessite une confirmation explicite.

**F-004 — Passage en classe supérieure**
- Acteur : Administrateur / Agent d'inscription.
- Préconditions : nouvelle année scolaire ouverte.
- Comportement : changement collectif ou individuel de la classe des élèves d'une classe vers la classe suivante.
- Règles associées : BR-003.
- Critères d'acceptation : l'historique de la classe précédente et de l'année scolaire correspondante reste consultable après le passage.

**F-005 — Gestion des redoublements**
- Acteur : Administrateur / Agent d'inscription.
- Comportement : un élève reste dans la même classe pour l'année scolaire suivante au lieu de passer à la classe supérieure.
- Règles associées : BR-003.
- Critères d'acceptation : le statut « redoublant » est visible dans l'historique du parcours scolaire de l'élève.

**F-006 — Historique du parcours scolaire**
- Acteur : Administrateur / Agent d'inscription.
- Comportement : consultation, pour un élève donné, de la liste des classes et années scolaires suivies, avec le statut (admis, redoublant, transféré).
- Critères d'acceptation : l'historique reste consultable même après plusieurs années scolaires et plusieurs passages de classe.

**F-007 — Recherche rapide des élèves**
- Acteur : tout utilisateur autorisé.
- Comportement : recherche par nom, matricule, ou classe.
- Critères d'acceptation : un résultat pertinent est retourné pour une recherche partielle sur le nom ou le matricule.

**F-008 — Consultation de la liste des élèves par classe**
- Acteur : tout utilisateur autorisé.
- Comportement : affichage et export de la liste des élèves inscrits dans une classe pour une année scolaire donnée.
- Critères d'acceptation : la liste peut être exportée en document imprimable (voir F-011).

**F-009 — Génération de l'attestation d'inscription**
- Acteur : Agent d'inscription.
- Comportement : production d'un document reprenant les informations administratives de l'élève et son statut d'inscription pour l'année en cours.
- Critères d'acceptation : le document est prêt à l'impression et reprend des informations toujours à jour au moment de la génération.

**F-010 — Génération du certificat de scolarité**
- Acteur : Agent d'inscription.
- Comportement : identique à F-009 pour ce type de document.
- Critères d'acceptation : identique à F-009.

**F-011 — Génération de la liste des élèves par classe (document imprimable)**
- Acteur : Agent d'inscription / Administrateur.
- Comportement : export imprimable de la liste consultée en F-008.

**F-012 — Génération de la fiche individuelle de l'élève**
- Acteur : Agent d'inscription / Administrateur.
- Comportement : document reprenant l'ensemble des informations administratives et, le cas échéant, le résumé de sa situation financière.

### Module Caisse

**F-013 — Enregistrement d'une entrée de caisse**
- Acteur : Caissier.
- Préconditions : pour un paiement lié à un élève, l'élève doit exister dans le système (voir précondition générale du module Élèves).
- Comportement : saisie du type d'opération (frais d'inscription, scolarité, frais divers, don, autre recette), du montant, et de l'élève concerné le cas échéant. L'opération est enregistrée et un reçu est généré (voir F-018).
- Règles associées : BR-004, BR-005.
- Critères d'acceptation : toute entrée de caisse enregistrée est horodatée, attribuée à l'utilisateur qui l'a saisie, et immédiatement reflétée dans le compte de scolarité de l'élève et dans le solde de caisse.

**F-014 — Enregistrement d'une sortie de caisse**
- Acteur : Caissier / Administrateur.
- Comportement : saisie d'une dépense (dépense quotidienne, salaire, achat de fournitures, charge diverse) avec montant, motif et catégorie.
- Critères d'acceptation : toute sortie de caisse réduit le solde disponible et est historisée au même titre qu'une entrée.

**F-015 — Historique complet des transactions / Journal de caisse**
- Acteur : Administrateur / Caissier.
- Comportement : consultation chronologique de toutes les opérations (entrées et sorties) avec filtres par date, type, montant, utilisateur.
- Critères d'acceptation : le journal reflète l'intégralité des opérations enregistrées, sans possibilité de suppression silencieuse (voir BR-005).

**F-016 — Recherche et filtrage des opérations**
- Acteur : Administrateur / Caissier.
- Comportement : recherche d'une opération précise par élève, montant, date ou type.

**F-017 — Rapports de caisse (journaliers, mensuels, annuels)**
- Acteur : Administrateur.
- Comportement : génération d'un état récapitulatif des entrées et sorties sur une période donnée.
- Critères d'acceptation : le total du rapport correspond exactement à la somme des opérations enregistrées sur la période sélectionnée.

**F-018 — Génération automatique du reçu de paiement**
- Acteur : système, déclenché par le Caissier lors de F-013.
- Comportement : dès qu'un paiement est enregistré et sauvegardé, un reçu est généré immédiatement et envoyé à l'impression, sans action supplémentaire du caissier.
- Règles associées : BR-007.
- Critères d'acceptation : aucun paiement n'est enregistré sans qu'un reçu correspondant soit généré ; le reçu porte un identifiant unique traçable dans le journal de caisse.

**F-019 — Tableau de bord financier**
- Acteur : Administrateur.
- Comportement : vue synthétique de l'état de la caisse (solde, recettes/dépenses récentes, arriérés globaux).

**F-020 — Compte de scolarité individuel par élève**
- Acteur : Administrateur / Caissier.
- Comportement : pour un élève donné, vue consolidée du détail par tranche (montant attendu, date d'échéance, montant payé) issu du barème de frais de sa classe (F-027), et du solde restant global.
- Règles associées : BR-006, BR-010.
- Critères d'acceptation : le solde affiché correspond exactement, tranche par tranche, à la différence entre le montant attendu selon le barème de la classe de l'élève et la somme des paiements enregistrés pour cette tranche.

**F-021 — Consultation des soldes et arriérés**
- Acteur : Administrateur.
- Comportement : liste des élèves ayant au moins une tranche en arriéré (date d'échéance dépassée, montant non intégralement payé), avec le montant dû.
- Règles associées : BR-010.

### Module Personnel (version simplifiée, incluse au MVP)

> **Décision confirmée :** pour le MVP, le Module Personnel ne couvre pas une gestion RH complète. Il permet uniquement d'enregistrer le personnel avec son salaire mensuel, et de suivre mensuellement si ce salaire a été payé, afin d'obtenir un état de paiement des salaires. La gestion des avances, retenues, primes et contrats est repoussée en post-MVP.

**F-022 — Enregistrement du personnel**
- Acteur : Administrateur.
- Comportement : création d'une fiche employé avec ses informations administratives et le salaire mensuel perçu.
- Critères d'acceptation : le salaire mensuel renseigné sur la fiche employé sert de référence pour le suivi mensuel du paiement (F-023).

**F-023 — Suivi mensuel du paiement des salaires**
- Acteur : Administrateur.
- Préconditions : l'employé est enregistré (F-022) avec un salaire mensuel défini.
- Comportement : chaque mois, le système affiche pour chaque employé une action « Payer le salaire ». Le déclenchement de cette action enregistre dans la base de données que le salaire de ce mois a été payé pour cet employé, et crée automatiquement une sortie de caisse correspondante.
- Règles associées : BR-008, BR-009.
- Critères d'acceptation : l'état « payé / non payé » du mois en cours est visible pour chaque employé ; un même mois ne peut pas être marqué payé deux fois pour le même employé.

**F-024 — État et historique des paiements de salaire**
- Acteur : Administrateur.
- Comportement : consultation, pour un mois donné ou pour un employé donné, de l'état des paiements (payé / non payé) et de l'historique des mois précédents.

**F-025 — Documents du personnel (liste du personnel, état mensuel des paiements de salaire)**
- Acteur : Administrateur.
- Comportement : génération de documents imprimables récapitulant la liste du personnel et l'état des paiements de salaire du mois sélectionné.

### Module Paramètres

**F-026 — Configuration de l'année scolaire en cours**
- Acteur : Administrateur.
- Comportement : définir quelle année scolaire est active dans l'application ; les nouvelles inscriptions et opérations de caisse s'y rattachent par défaut.
- Critères d'acceptation : le changement d'année scolaire en cours ne modifie ni ne masque les données des années précédentes (cf. F-006).

**F-027 — Configuration du barème des frais de scolarité par classe**
- Acteur : Administrateur.
- Comportement : pour chaque classe, définition du nombre de tranches de frais de scolarité, du montant de chaque tranche et de sa date d'échéance.
- Règles associées : BR-010.
- Critères d'acceptation : le barème configuré pour une classe s'applique automatiquement au compte de scolarité (F-020) et à la détection des arriérés (F-021) de tous les élèves de cette classe.
- Exemple illustratif : pour la classe de CI, une première tranche de 30 000 F doit être payée avant une date d'échéance donnée ; si, cette date passée, un parent n'a rien payé ou n'a payé qu'une partie de cette tranche, l'élève apparaît en arriéré pour le solde restant de cette tranche.

---

## 6. Règles métier

- **BR-001** : Un élève doit obligatoirement exister dans le système avant toute opération de caisse le concernant.
- **BR-002** : Le numéro matricule d'un élève est unique, généré automatiquement par le système, et n'est jamais réutilisé même après suppression de l'élève.
- **BR-003** : Un élève ne peut avoir qu'un seul statut de progression par année scolaire (passage en classe supérieure OU redoublement OU transfert), jamais plusieurs simultanément.
- **BR-004** : Toute entrée de caisse doit être rattachée à une catégorie (frais d'inscription, scolarité, frais divers, don, autre recette).
- **BR-005** : Une opération de caisse déjà enregistrée ne peut pas être supprimée ; toute correction se fait par une opération d'annulation ou de régularisation traçable, afin de préserver l'intégrité du journal de caisse.
- **BR-006** : L'historique financier d'un élève est conservé même si la fiche administrative de l'élève est supprimée du dossier actif.
- **BR-007** : Aucun paiement ne peut être considéré comme finalisé tant que le reçu correspondant n'a pas été généré.
- **BR-008** : Un paiement de salaire enregistré dans le module Personnel doit apparaître comme une sortie de caisse dans le module Caisse (les deux modules partagent le même journal financier).
- **BR-009** : Le salaire d'un employé pour un mois donné ne peut être marqué payé qu'une seule fois ; toute correction nécessite une opération de régularisation traçable (cf. BR-005).
- **BR-010** : Une tranche de frais de scolarité est considérée en arriéré dès que sa date d'échéance est dépassée sans que son montant ait été intégralement payé (paiement partiel inclus).

---

## 7. Parcours utilisateur

### Parcours 1 — Inscription d'un nouvel élève
1. L'agent d'inscription ouvre le formulaire d'inscription.
2. Il saisit les informations de l'élève et du responsable.
3. Le système valide que les champs obligatoires sont renseignés.
4. Le système attribue un matricule unique.
5. La fiche élève est enregistrée et devient consultable immédiatement.
6. **Scénario d'erreur** : un champ obligatoire est manquant → le système bloque l'enregistrement et indique le ou les champs concernés.
7. **Scénario d'erreur** : tentative de créer une fiche en double (même élève, même année) → le système alerte l'utilisateur et lui propose de consulter la fiche existante.

### Parcours 2 — Enregistrement d'un paiement et remise du reçu
1. Le parent se présente au guichet et effectue son paiement en espèces (ou autre moyen physique).
2. Le caissier recherche l'élève dans le système.
3. Le caissier sélectionne le type de frais et saisit le montant reçu.
4. Le système enregistre l'opération dans le journal de caisse et met à jour le compte de scolarité de l'élève.
5. Le système génère automatiquement le reçu et lance l'impression.
6. Le parent repart avec son reçu imprimé.
7. **Scénario d'erreur** : l'élève recherché n'existe pas dans le système → le caissier ne peut pas enregistrer le paiement tant que l'élève n'a pas été inscrit (renvoi vers le Parcours 1).
8. **Scénario d'erreur** : échec de l'impression après enregistrement du paiement → l'opération financière reste enregistrée (elle n'est pas annulée) et le système permet de relancer l'impression du même reçu à l'identique.

### Parcours 3 — Génération d'un rapport financier mensuel
1. L'administrateur sélectionne la période souhaitée.
2. Le système agrège toutes les entrées et sorties de caisse de la période.
3. Le rapport est affiché avec le détail par catégorie et le solde net.
4. L'administrateur exporte ou imprime le rapport.
5. **Scénario d'erreur** : aucune opération enregistrée sur la période → le système affiche un rapport vide avec un message explicite plutôt qu'une erreur.

### Parcours 4 — Passage en classe supérieure en fin d'année
1. L'administrateur ouvre la fonction de passage de classe pour une classe donnée.
2. Le système propose la liste des élèves de cette classe.
3. L'administrateur valide, pour chaque élève, le passage à la classe supérieure ou le redoublement.
4. Le système applique les changements pour la nouvelle année scolaire tout en conservant l'historique de l'année précédente.
5. **Scénario d'erreur** : validation partielle interrompue (ex. fermeture du logiciel en cours d'opération) → aucun élève ne doit se retrouver dans un état incohérent (mi-traité, mi-non traité) ; l'opération doit pouvoir reprendre proprement.

---

## 8. Données fonctionnelles

**Entité Élève**
- Identité : photo, nom, prénom(s), sexe, date de naissance, lieu de naissance, nationalité (Béninoise par défaut), adresse de résidence.
- Scolarité : matricule (généré), année scolaire, classe, école de provenance (si transfert), statut (nouveau, redoublant, transféré).
- Responsable légal : nom et prénom, téléphone, profession (au moins un responsable requis).

**Entité Responsable / Tuteur**
- Nom, prénom, téléphone, profession, lien avec l'élève.

**Entité Opération de caisse**
- Type (entrée / sortie), catégorie, motif de l'opération, montant, date et heure, élève concerné (si applicable), utilisateur ayant enregistré l'opération, moyen indiqué (ex. espèces — à confirmer si d'autres moyens doivent être distingués), statut (validée / annulée-régularisée).

**Entité Reçu**
- Identifiant unique, opération de caisse associée, montant, date, élève ou bénéficiaire concerné.

**Entité Employé (Personnel)**
- Nom, prénom, fonction, informations de contact, historique des salaires versés.

**Entité Compte de scolarité (dérivé)**
- Élève associé, barème de frais applicable (issu de sa classe), détail par tranche (montant attendu, date d'échéance, montant payé à ce jour, statut à jour/en arriéré), solde restant global.

**Entité Barème de frais (par classe)**
- Classe associée, année scolaire, liste des tranches de frais de scolarité, chaque tranche étant définie par un montant et une date d'échéance.

**Entité Paramètres de l'application**
- Année scolaire en cours, barèmes de frais par classe (voir entité ci-dessus).

> **Décision confirmée :** les frais de scolarité attendus sont liés à la classe de l'élève et définis sous forme d'un échéancier en plusieurs tranches (montant + date d'échéance par tranche), configurable par l'établissement dans les paramètres de l'application. L'année scolaire en cours est également configurable dans les paramètres (voir F-026, F-027).

---

## 9. Exigences non fonctionnelles

**Sécurité**
- L'accès au logiciel doit être protégé par une authentification (identifiant / mot de passe ou équivalent).
- Toute action de modification ou de suppression de données financières ou de dossier élève doit être attribuable à un utilisateur identifié (traçabilité).

**Confidentialité**
- Les données personnelles des élèves et de leurs responsables (coordonnées, photo) doivent être accessibles uniquement aux utilisateurs autorisés du logiciel.

**Fiabilité / Intégrité**
- Aucune opération de caisse validée ne doit pouvoir être perdue ou modifiée silencieusement après son enregistrement (cf. BR-005).
- Le solde de caisse affiché doit toujours correspondre exactement à la somme des opérations enregistrées.
- Les données de l'application doivent faire l'objet de sauvegardes régulières vers un espace de stockage distant (cloud), afin de permettre la récupération complète des données en cas de panne ou de perte du poste local.

**Disponibilité**
- Le logiciel doit rester utilisable pour les opérations quotidiennes (inscription, encaissement, impression de reçu) pendant les horaires d'ouverture de l'établissement, y compris en cas d'absence de connexion internet (le logiciel étant décrit comme une application desktop).

**Performance**
- La recherche d'un élève doit renvoyer un résultat perceptible comme instantané pour un établissement de taille courante (quelques centaines à quelques milliers d'élèves).
- La génération et le lancement d'impression d'un reçu doivent s'effectuer sans délai perceptible pour le parent qui attend au guichet.

**Accessibilité / Ergonomie**
- Les écrans de saisie fréquente (inscription, encaissement) doivent permettre une saisie rapide, adaptée à un usage quotidien intensif par du personnel non technicien.

**Compatibilité**
- Le système doit pouvoir piloter une imprimante thermique de reçus (mentionné comme exigence fonctionnelle, la nature exacte du matériel relevant d'ARCHITECTURE.md).

> **Point ouvert** : aucune exigence chiffrée précise (nombre d'utilisateurs simultanés, volumétrie maximale d'élèves, fréquence exacte des sauvegardes cloud) n'est fournie à ce stade.

---

## 10. Gestion des erreurs

- **Champ obligatoire manquant** (inscription élève, saisie de paiement) : blocage de l'enregistrement, message indiquant précisément le ou les champs à corriger.
- **Élève introuvable lors d'un encaissement** : blocage de l'opération de caisse, redirection possible vers l'inscription de l'élève.
- **Doublon d'inscription** (même élève déjà inscrit pour l'année) : alerte et proposition de consulter la fiche existante plutôt que création automatique d'un doublon.
- **Échec d'impression du reçu** : l'opération financière reste enregistrée et valide ; possibilité de réimprimer le même reçu à l'identique sans dupliquer l'opération financière.
- **Interruption en cours d'opération multi-étapes** (ex. passage de classe collectif) : le système ne doit laisser aucun élève dans un état intermédiaire incohérent.
- **Tentative de suppression d'une opération de caisse déjà validée** : refusée par le système, seule une opération d'annulation/régularisation traçable est permise (cf. BR-005).

---

## 11. Hypothèses

- **A-001** : Chaque installation du logiciel correspond à un seul établissement scolaire (pas de gestion multi-établissements dans une même base), conformément à la nature desktop et hors ligne du logiciel. *Confirmé.*
- **A-002** : Les paiements sont exclusivement des paiements physiques (espèces ou équivalent remis au guichet) ; le logiciel n'intègre aucun moyen de paiement électronique.
- **A-003** : Un mécanisme d'authentification des utilisateurs (identifiant/mot de passe ou équivalent) est requis pour accéder au logiciel. *Confirmé.*
- **A-004** : Le Module Personnel est inclus au MVP sous une forme simplifiée (enregistrement du personnel avec salaire mensuel fixe, marquage mensuel payé/non payé) ; la gestion complète des avances, retenues, primes et contrats est repoussée en post-MVP. *Confirmé.*
- **A-005** : Une seule devise est utilisée (Franc CFA, implicite au contexte béninois) ; aucune gestion multi-devises n'est requise.

---

## 12. Contraintes

- Le logiciel doit fonctionner en environnement desktop, dans un contexte où la connexion internet peut être absente ou instable (contrainte contextuelle, pas un choix technique imposé ici).
- Le logiciel doit pouvoir piloter une impression physique de reçus au moment de l'encaissement, sans étape manuelle intermédiaire.
- Le public cible (personnel administratif d'écoles privées béninoises) n'est pas nécessairement technophile : les parcours de saisie doivent rester simples.

---

## 13. Risques et points ouverts

- **Risque** : la suppression d'un élève (F-003) pose un risque de perte d'historique si les règles de conservation (BR-006) ne sont pas strictement appliquées dès la conception.
- **Ambiguïté** : le texte source ne précise pas si un élève peut être inscrit dans plusieurs classes/niveaux la même année (cas de transfert en cours d'année) ni comment cela s'articule avec BR-003.
- **Dépendance importante** : le bon fonctionnement du système de reçus automatiques (fonctionnalité phare) dépend d'un matériel d'impression physique ; le comportement du logiciel en cas d'indisponibilité de ce matériel doit être clairement défini (traité en section 10, mais les modalités précises restent à valider avec l'établissement).
- **Point de complexité future** : l'extension du Module Personnel simplifié vers une gestion RH complète (avances, retenues, primes, contrats) introduira une complexité comptable supplémentaire à traiter au moment de son développement (post-MVP).

---

## 14. Critères de réussite du produit (MVP)

- Un établissement peut inscrire un élève entièrement via le logiciel, sans recours au cahier papier.
- Un établissement peut enregistrer un paiement et remettre un reçu imprimé au parent en moins de temps que le processus manuel actuel.
- Un rapport financier journalier peut être produit à tout moment sans recomposition manuelle des données.
- Aucune opération de caisse enregistrée n'est perdue lors d'une utilisation normale du logiciel.
- Le personnel administratif de l'établissement est capable d'utiliser les fonctions courantes (inscription, encaissement) après une prise en main simple, sans formation technique poussée.

---

## 15. Évolutions futures

- Portail ou notification pour les parents (rappel d'échéance de paiement, consultation à distance du solde).
- Extension à la gestion pédagogique (notes, bulletins, emplois du temps).
- Gestion multi-établissements pour des réseaux scolaires possédant plusieurs sites.
- Statistiques et indicateurs avancés (taux de recouvrement, comparaison inter-classes, prévisions de trésorerie).
- Sauvegarde et synchronisation à distance des données.

---

## 16. Analyse des risques

| Risque | Impact | Zone concernée |
|---|---|---|
| Dépendance à l'impression physique pour les reçus | Blocage du service au guichet en cas de panne matérielle | Système de reçus |
| Suppression de fiche élève avec historique financier | Perte ou incohérence de données financières historiques | Module Élèves / Caisse |
| Absence d'exigences chiffrées précises (volumétrie, utilisateurs simultanés) | Difficulté à valider objectivement la performance et la disponibilité du système | Exigences non fonctionnelles |
| Extension future du Module Personnel vers une gestion RH complète | Complexité comptable supplémentaire à maîtriser lors du développement post-MVP | Module Personnel |

---

## Questions nécessitant une décision

Aucune question bloquante à ce stade. Les points précédemment ouverts ont été tranchés :
- Structure des frais de scolarité → échéancier en plusieurs tranches, par classe, configurable (F-027).
- Authentification → confirmée comme exigence (section 9, A-003).
- Périmètre du Module Personnel pour le MVP → version simplifiée confirmée (enregistrement + marquage mensuel du paiement), gestion RH complète en post-MVP (A-004).
- Sauvegarde des données → sauvegardes régulières vers le cloud confirmées comme exigence (section 9).

Un point mineur reste à préciser lors des prochaines itérations : la fréquence exacte des sauvegardes cloud et les seuils de volumétrie/utilisateurs simultanés à supporter (voir section 9, point ouvert).
