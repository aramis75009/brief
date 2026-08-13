"use client";

import { CheckIcon } from "./icons";

/**
 * La coche « fait ».
 *
 * TROIS CONTRAINTES DU SYSTÈME, toutes documentées dans DESIGN.md :
 *
 * 1. **Ce n'est pas un rond.** Les formes (`disc`, `ring`, `square`, `diamond`,
 *    `capsule`) encodent les projets — c'est la seconde dimension d'une
 *    destination. Une case ronde ou en anneau se lirait comme un marqueur de
 *    projet, et comme un bouton radio plutôt que comme une case à cocher.
 *
 *    ⚠️ La taille de la boîte n'est donc PAS libre : le rayon `chip` vaut 10 px,
 *    et sur une boîte de 22 px cela donne un ratio de 0,45 — soit un cercle
 *    parfait à un cheveu près. Vérifié en capture, c'était bien un rond. À
 *    26 px le ratio tombe à 0,38 et la forme redevient un carré arrondi, sans
 *    sortir de l'échelle de rayons du système.
 *
 * 2. **La coche est en `--page`, pas en blanc.** `--color-ok` vaut `#3F6B4A` en
 *    clair mais `#7FAE87` en sombre : un glyphe blanc y tomberait à 2,53:1.
 *    `--page` s'inverse avec le thème et donne 5,56:1 en clair, 7,63:1 en
 *    sombre — mesuré. Même piège que `--error-on-ink`, déjà payé une fois.
 *
 * 3. **Contour non coché en `--ink-3`, pas en `--line-2`.** `--line-2` est une
 *    bordure de champ : 1,34:1 sur la tuile claire, très en dessous des 3:1
 *    qu'exige un contrôle d'interface. Une case qu'on ne voit pas n'est pas une
 *    case. `--ink-3` donne 3,17:1 en clair et 3,29:1 en sombre, et c'est déjà le
 *    token du contour pointillé de l'état « en attente » — un précédent du
 *    système, pas un écart.
 *
 * 4. **Cible tactile de 44 px**, ramenée à 26 px visuels par une marge négative.
 *    C'est une liste qu'on parcourt au pouce ; une case de 26 px se rate.
 *
 * L'état coché ne repose pas sur la seule couleur : le glyphe le porte aussi,
 * et la ligne appelante barre son titre. Trois signaux cumulés, comme l'état
 * « en attente d'envoi ».
 */
export function DoneBox({
  done,
  busy = false,
  label,
  onToggle,
}: {
  done: boolean;
  busy?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={
        "-m-[9px] flex h-11 w-11 flex-none items-center justify-center border-none bg-transparent p-0 " +
        "transition-transform duration-[180ms] active:scale-[.985] " +
        (busy ? "cursor-default opacity-60" : "cursor-pointer")
      }
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-chip transition-all duration-[90ms] text-page"
        style={
          done
            ? { background: "var(--color-ok)", border: "1.5px solid var(--color-ok)" }
            : { background: "transparent", border: "1.5px solid var(--color-ink-3)" }
        }
      >
        {done && <CheckIcon size={14} />}
      </span>
    </button>
  );
}
