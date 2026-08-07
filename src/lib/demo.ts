/** Notes de démo de la maquette — permettent de tester sans micro. */
export const DEMO_NOTES = [
  "Photographier le lot de polos Ralph Lauren demain 14h, puis republier les annonces Vinted, et aussi relancer l'acheteur du lot de sneakers c'est urgent",
  "Il faut finir l'exercice React avant vendredi, ensuite corriger le bug de l'API, également préparer la soutenance lundi c'est important",
  "Passer chercher les colis à la poste ce soir, puis mettre à jour le stock, et aussi appeler le fournisseur pour la nouvelle carte du restaurant",
  "Faire les fiches techniques des desserts, ensuite envoyer la facture au comptable dès que possible, également prendre rdv médecin la semaine prochaine",
];

let seq = 100;
export const uid = () => "t" + ++seq;
