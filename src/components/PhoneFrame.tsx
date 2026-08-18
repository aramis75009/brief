/**
 * Coque de l'app — cadre iOS 390×844 sur desktop, plein écran sur mobile.
 * Fond canvas #EFEEEA (couleur du design system Claude Design).
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center sm:px-4 sm:py-7" style={{ background: "#EFEEEA" }}>
      <div
        className="safe-x relative flex h-dvh w-full flex-col overflow-hidden bg-bg sm:h-[844px] sm:w-[390px] sm:rounded-[44px] sm:border-[10px] sm:border-[#101010] sm:shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Barre d'état simulée (uniquement sur desktop, dans le cadre).
 * Sur un vrai iPhone, la safe area gère l'espace.
 */
export function StatusBar() {
  return (
    <div className="hidden h-[58px] flex-none sm:flex sm:items-center sm:justify-between sm:px-7 sm:pt-2">
      <span className="text-[15px] font-bold">9:41</span>
      <span className="flex items-center gap-1">
        {/* Signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="3" width="3" height="8" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
        {/* Wifi */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 11l2-2.5a3 3 0 0 0-4 0L8 11zM8 7a5 5 0 0 1 3.5 1.5l1.5-1.5a7 7 0 0 0-10 0L4.5 8.5A5 5 0 0 1 8 7zM8 3a9 9 0 0 1 6 2.5l1.5-1.5a11 11 0 0 0-15 0L2 5.5A9 9 0 0 1 8 3z"/></svg>
        {/* Battery */}
        <svg width="27" height="12" viewBox="0 0 27 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="19" height="8" rx="1.5" fill="currentColor"/><rect x="23" y="3.5" width="2" height="5" rx="1" fill="currentColor" opacity=".4"/></svg>
      </span>
    </div>
  );
}