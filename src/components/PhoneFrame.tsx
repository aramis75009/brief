/**
 * Coque de l'app.
 *
 * La maquette pose un iPhone 390×844 posé sur un fond #DCD8D2. Sur un vrai
 * téléphone ce cadre n'a pas de sens : l'app occupe l'écran et les safe areas
 * remplacent la barre d'état simulée. On garde donc le cadre à partir de `sm`
 * (usage bureau / relecture du design) et on passe plein écran en dessous.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center sm:px-4 sm:py-7">
      <div
        className="
          relative flex h-dvh w-full flex-col overflow-hidden bg-surface
          sm:h-[844px] sm:w-[390px] sm:rounded-[44px]
          sm:shadow-[0_30px_70px_-20px_rgba(28,26,24,0.38),0_0_0_1px_rgba(28,26,24,0.06)]
        "
      >
        {children}
      </div>
    </div>
  );
}

/** Barre d'état simulée — masquée sur mobile, où la vraie prend le relais. */
export function StatusBar() {
  return (
    <>
      <div className="hidden h-11 flex-none items-end justify-between px-[26px] pb-1 text-[12.5px] font-semibold tracking-[0.2px] text-ink sm:flex">
        <span>9:41</span>
        <span className="flex items-center gap-[5px] opacity-75">
          <span className="relative block h-2 w-4 rounded-[2.5px] border-[1.4px] border-ink">
            <span className="absolute inset-[1.2px] right-[5px] rounded-[1px] bg-ink" />
          </span>
        </span>
      </div>
      <div className="h-[env(safe-area-inset-top)] flex-none sm:hidden" />
    </>
  );
}
