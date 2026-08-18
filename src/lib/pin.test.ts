import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPin, getPin, setPin } from "./pin";

/**
 * L'environnement de test est `node` : on installe des mocks minimaux de
 * `window` / `document` / `localStorage` pour exercer le double stockage
 * (cookie persistant + localStorage) sans navigateur.
 */

let storage = new Map<string, string>();
let cookie = "";

const fakeLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
};

beforeEach(() => {
  storage = new Map();
  cookie = "";
  vi.stubGlobal("window", { localStorage: fakeLocalStorage });
  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      // Simule le comportement navigateur : `Max-Age=0` expire le cookie.
      if (/Max-Age=0/.test(v)) {
        cookie = "";
        return;
      }
      cookie = v;
    },
  });
  vi.stubGlobal("location", { protocol: "https:" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function cookieValue(): string | null {
  const m = cookie.match(/(?:^|;\s*)brief_pin=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

describe("mémorisation du PIN (localStorage + cookie)", () => {
  it("setPin écrit dans le localStorage ET le cookie", () => {
    setPin("030920");
    expect(storage.get("brief:pin")).toBe("030920");
    expect(cookieValue()).toBe("030920");
  });

  it("getPin lit le cookie en priorité (il survit aux purges iOS du localStorage)", () => {
    // Le localStorage a été purgé par iOS, le cookie est resté.
    cookie = "brief_pin=030920; Max-Age=34560000; Path=/; SameSite=Lax";
    expect(getPin()).toBe("030920");
  });

  it("getPin migre un PIN resté dans le localStorage vers le cookie", () => {
    storage.set("brief:pin", "030920");
    expect(getPin()).toBe("030920");
    expect(cookieValue()).toBe("030920");
  });

  it("getPin renvoie null quand ni le cookie ni le localStorage n'ont de PIN", () => {
    expect(getPin()).toBeNull();
  });

  it("clearPin efface le localStorage ET le cookie", () => {
    setPin("030920");
    clearPin();
    expect(storage.has("brief:pin")).toBe(false);
    expect(cookieValue()).toBeNull();
  });

  it("ne plante pas sans window (rendu serveur)", () => {
    vi.unstubAllGlobals();
    expect(getPin()).toBeNull();
    expect(() => setPin("030920")).not.toThrow();
    expect(() => clearPin()).not.toThrow();
  });
});
