# ---------------------------------------------------------------------------
# Brief — image de production pour le VPS.
#
# Trois étages : dépendances, build, exécution. Le dernier ne contient ni les
# sources ni les dépendances de développement.
#
# ⚠️ Le VOLUME est ce qui rend Brief utilisable : sans lui, /app/data disparaît
# à chaque redéploiement, et avec lui toute l'organisation. C'est le seul état
# du système.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables NEXT_PUBLIC_* sont inlinées AU BUILD : sans elles ici, la clé
# VAPID publique vaut undefined dans le bundle et l'abonnement échoue.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_APP_NAME=Brief
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Les données vivent hors de l'arborescence applicative, sur un volume.
ENV BRIEF_DATA_DIR=/app/data

RUN addgroup -g 1001 -S nodejs && adduser -S brief -u 1001 \
 && mkdir -p /app/data && chown -R brief:nodejs /app

COPY --from=build --chown=brief:nodejs /app/.next/standalone ./
COPY --from=build --chown=brief:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=brief:nodejs /app/public ./public

USER brief
EXPOSE 3000
VOLUME ["/app/data"]

# Sonde de vie : /api/session sans PIN doit répondre 401. Un 401 prouve d'un
# coup que le serveur répond, que le garde fonctionne, et que BRIEF_PIN est bien
# chargé — sans PIN, `requirePin` renvoie 503 et la sonde échoue à raison.
# Un 200 signalerait une porte ouverte.
#
# ⚠️ Deux pièges déjà payés ici :
#   - la route n'expose que POST ; un GET renvoie 405, jamais 401 ;
#   - le wget d'Alpine est celui de busybox, qui ignore les options GNU comme
#     `--server-response`. On passe donc par `node`, déjà présent dans l'image,
#     qui donne le code de statut exact sans dépendance ni ambiguïté.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/session',{method:'POST'}).then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
