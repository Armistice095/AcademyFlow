-- Google Drive devient l'unique source de vérité de l'historique des
-- sauvegardes cloud (correctif : l'historique local pouvait être vide après
-- réinitialisation de la base alors que les fichiers restaient sur Drive).
DROP TABLE `BACKUP_HISTORY`;
