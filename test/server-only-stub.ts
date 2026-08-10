/**
 * `server-only` lève à l'import hors contexte serveur — c'est sa raison d'être :
 * empêcher qu'un module manipulant des secrets ou le disque finisse dans le
 * bundle client. Cette protection n'a pas de sens sous vitest, qui tourne en
 * Node. On l'aliase donc vers un module vide UNIQUEMENT pour les tests.
 *
 * Ne jamais aliaser ça dans la config Next : la garde y est utile.
 */
export {};
