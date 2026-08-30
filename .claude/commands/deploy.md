# deploy — Demander à Aramis (Hermes) de déployer sur le VPS

Quand tu as terminé tes modifications et que l'utilisateur demande un déploiement (ou que tu juges qu'un déploiement est nécessaire), envoie une demande à Aramis via le webhook Hermes :

1. Exécute le script de déploiement avec un message décrivant ce qui a changé :
   ```bash
   bash .claude/commands/deploy.sh "Déploiement: <résumé des changements>"
   ```

2. Le script POSTe vers `https://webhook.srv1899780.hstgr.cloud/webhooks/deploy` avec signature HMAC-SHA256 (secret lu dans `.env.local`, jamais commité).

3. Aramis (Hermes) reçoit la demande, exécute le déploiement sur le VPS (fetch + pull + status.sh, conventions du projet), et confirme le résultat sur Telegram.

4. Informe l'utilisateur que la demande a été envoyée et que la confirmation arrivera sur Telegram.

**Important** : ne déploie pas toi-même via SSH — c'est Aramis qui gère le déploiement. Ton rôle est de signaler proprement.
