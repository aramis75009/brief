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
# Même piège, en pire : ces deux-là sont lues par `src/proxy.ts`, qui s'exécute
# sur PRESQUE TOUTES les requêtes. Absentes au build, elles sont inlinées à
# undefined jusque dans le bundle serveur (`output: standalone`) et c'est le
# site entier — écran de connexion compris — qui tombe, pas une seule route.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
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
# La version, pour que `docker exec brief-app-1 cat /app/VERSION` dise ce qui
# tourne vraiment. La sortie `standalone` ne copie que ce que le serveur Next
# exécute : sans cette ligne, le fichier existe dans le dépôt et le conteneur
# rend une chaîne vide — c'est-à-dire la même réponse qu'un déploiement raté.
COPY --from=build --chown=brief:nodejs /app/VERSION ./VERSION

USER brief
EXPOSE 3000
VOLUME ["/app/data"]

# Sonde de vie : GET /api/auth/session sans cookie doit répondre 401. Un 401
# prouve d'un coup que le serveur répond, que la garde de session fonctionne et
# que les variables Supabase sont bien chargées — sans elles,
# `getSupabaseServerClient()` lève et la route rend 500, donc la sonde échoue à
# raison. Un 200 signalerait une porte ouverte.
#
# ⚠️ Deux pièges déjà payés ici :
#   - la MÉTHODE compte : la route n'expose que GET, un POST renvoie 405 et
#     jamais 401 (c'était l'inverse du temps de l'ancienne route PIN) ;
#   - le wget d'Alpine est celui de busybox, qui ignore les options GNU comme
#     `--server-response`. On passe donc par `node`, déjà présent dans l'image,
#     qui donne le code de statut exact sans dépendance ni ambiguïté.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/auth/session').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
