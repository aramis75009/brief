/**
 * Coque de l'app.
 *
 * La maquette pose un iPhone 390×844 sur un fond #DCD8D2. Sur un vrai téléphone
 * ce cadre n'a pas de sens : l'app occupe l'écran et les safe areas remplacent
 * la barre d'état simulée. On garde donc le cadre à partir de `sm` (usage
 * bureau / relecture du design) et on passe plein écran en dessous.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center sm:px-4 sm:py-7">
      {/* `bg-page` et NON `bg-tile`.
          `tile` est la couleur d'une CARTE posée sur la page ; l'employer pour la
          coque entière contredisait DESIGN.md et surtout le `theme-color` du
          manifeste, qui peint la zone de la barre d'état en `--color-page`. Deux
          couleurs voisines mais différentes qui se touchent en haut de l'écran :
          d'où la couture visible sur iPhone, là où une app bien intégrée ne
          montre aucune limite entre la barre d'état et son contenu. */}
      <div
        className="
          safe-x relative flex h-dvh w-full flex-col overflow-hidden bg-page
          sm:h-[844px] sm:w-[390px] sm:rounded-[44px]
          sm:shadow-[0_30px_70px_-20px_rgba(19,18,17,0.38),0_0_0_1px_rgba(19,18,17,0.06)]
        "
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Haut d'écran. Sur mobile : simple réserve de la hauteur de la status bar iOS,
 * pour que l'heure et la batterie se posent sur le fond crème sans recouvrir le
 * contenu. Sur `sm` : la barre d'état simulée de la maquette.
 */
export function StatusBar() {
  return (
    <>
      <div className="safe-top flex-none sm:hidden" />
      <div className="hidden h-11 flex-none items-end justify-between px-[26px] pb-1 text-13 font-semibold tracking-[0.2px] text-ink sm:flex">
        <span>9:41</span>
        <span className="flex items-center gap-[5px] opacity-75">
          <span className="relative block h-2 w-4 rounded-[2.5px] border-[1.4px] border-ink">
            <span className="absolute inset-[1.2px] right-[5px] rounded-[1px] bg-ink" />
          </span>
        </span>
      </div>
    </>
  );
}
