# Picon Counter

PWA personnelle offline pour compter uniquement des Picon-bières, avec DA rétro-futur, animations de verre et dashboard local.

## Lancer en local

```sh
python3 -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173/`.

## Fonctionnalités

- Compteur quotidien animé avec verre qui se remplit, bulles, mousse et effet de verse.
- Choix rapide du format : demi, pinte, léger, shwartz.
- Dashboard avec jauge hebdomadaire, courbe 14 jours, répartition par format et indicateurs de rythme.
- Suivi des jours sans alcool, hydratation, situations zéro, journal, export/import JSON.
- Données stockées uniquement en local dans le navigateur.

## Installation Android

Pour une vraie installation PWA sur Android, servir l'app depuis une origine HTTPS, puis utiliser l'action du navigateur `Ajouter à l'écran d'accueil`. Après le premier chargement, le service worker met les fichiers en cache pour l'usage offline.

Le serveur Python local est utile pour tester sur l'ordinateur. Pour installer depuis un téléphone sur le réseau local, il faudra une origine HTTPS ou emballer l'app avec un outil type Capacitor.

## Repères utilisés

Le calcul se base sur les repères français de consommation d'alcool :

- 1 verre standard = 10 g d'alcool pur.
- Maximum 2 verres standard par jour.
- Maximum 10 verres standard par semaine.
- Des jours dans la semaine sans alcool.
- Zéro alcool dans certaines situations, dont la conduite.

Sources officielles :

- Santé publique France : https://www.santepubliquefrance.fr/alcool/comment-reduire-les-risques-de-la-consommation-dalcool
- Alcool Info Service : https://www.alcool-info-service.fr/sinformer-et-evaluer-sa-consommation/alcool-et-sante/les-reperes-de-consommation-quest-ce-que-cest
