# Brief — brief de design v4 (Claude Design)

**Statut (2026-08-16, Aramis) :** le modèle produit, la liste des écrans/tâches
et la disposition mobile des previews v2/v3 sont **validés**. Le **copywriting**
et le **design visuel** sont rejetés en l'état : cette peau repart de zéro.

## Ce qui est verrouillé (ne pas rediscuter)

- Écrans : accueil-réponse (Maintenant / Ensuite / Rendez-vous / En retard /
  Plus tard) · dictée · « c'est noté » · triage à une question · plan du jour ·
  fiche avec provenance · registre (Tout) · états (vide, micro refusé,
  hors-ligne, échec IA, chargement) · desktop · thème clair.
- Disposition mobile : liste verticale, hiérarchie NOW d'abord, tabbar 3
  entrées avec micro central, sheets par le bas.
- Principes : friction proportionnelle à la confiance ; jamais inventer ;
  la note d'origine toujours conservée et montrée ; chaque panne a une issue.

## Ce qui est à refaire

1. **Copywriting** — tout le texte produit. Règles :
   - tutoiement, phrases courtes, ton calme et humain ;
   - zéro jargon produit (« triage », « embarquement », « structuration »
     interdits côté utilisateur) ;
   - zéro emoji, zéro point d'exclamation ;
   - chaque écran dit UNE chose ; les libellés de section sont des mots
     ordinaires (« Ensuite », « En retard », « Plus tard »).
2. **Peau visuelle** — nouvelle identité, ni bento v2 ni tableau-de-départs v3.
   Contraintes : lisible en plein soleil sur iPhone, cibles ≥ 44 px, hiérarchie
   par taille/poids/blanc plutôt que par cartes et ombres, un seul accent
   d'action + rouge retard + vert fait, thèmes sombre ET clair,
   `prefers-reduced-motion`.

## Références dans le dépôt

- Modèle & écrans : `docs/designs/preview-v2/` et `preview-v3/` (structure OK,
  peau KO).
- Tokens historiques (à titre documentaire) : `DESIGN.md` racine.
- Polices disponibles : `src/app/fonts/GeneralSans-*.woff2`.
