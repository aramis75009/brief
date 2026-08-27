import { describe, expect, it } from "vitest";
import { resolveDue } from "./due";
import {
  DUE_CLEAR,
  DUE_SUGGESTIONS,
  PRIORITIES,
  PRIORITY_VALUES,
  fallbackProjectId,
  isPriority,
  nextSkin,
  shapeFor,
  shapeFromId,
  skinFor,
  slugify,
  tintFromId,
  uniqueProjectId,
} from "./projects";
import { SEED_PROJECTS } from "./projects";
import type { Tint } from "./types";

describe("priorités", () => {
  it("1 est la plus haute — l'inverse de l'échelle d'où vient ce projet", () => {
    // Ce test existe pour qu'une réintroduction accidentelle de l'échelle
    // Todoist (4 = urgente) casse quelque chose de bruyant.
    expect(PRIORITY_VALUES[0]).toBe(1);
    expect(PRIORITIES[1].long).toContain("Urgent");
    expect(PRIORITIES[4].long).toContain("Basse");
  });

  it("refuse les valeurs hors échelle", () => {
    expect(isPriority(0)).toBe(false);
    expect(isPriority(5)).toBe(false);
    expect(isPriority("1")).toBe(false);
    expect(isPriority(1)).toBe(true);
  });
});

describe("teintes de projet", () => {
  it("rend des variables CSS, jamais des hexadécimaux — sinon pas de mode sombre", () => {
    const skin = skinFor({ id: "inbox", tint: 3 });
    expect(skin.bg).toBe("var(--color-p3)");
    expect(skin.fg).toBe("var(--color-p3-ink)");
  });

  it("dérive une teinte STABLE d'un id inconnu", () => {
    // Un projet qui changerait de couleur d'une session à l'autre rendrait la
    // vision globale illisible : c'est la couleur qu'on apprend, pas le nom.
    const first = tintFromId("un-projet-quelconque");
    expect(tintFromId("un-projet-quelconque")).toBe(first);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(8);
  });

  it("chaque projet d'amorçage a une teinte distincte", () => {
    const tints = SEED_PROJECTS.map((p) => p.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });
});

describe("formes de projet", () => {
  it("dérive une forme STABLE d'un id inconnu", () => {
    const first = shapeFromId("un-projet-quelconque");
    expect(shapeFromId("un-projet-quelconque")).toBe(first);
  });

  it("respecte la forme explicite d'un projet plutôt que le hachage", () => {
    // Sans ça, renommer un projet en changerait la pastille — or c'est la
    // pastille qu'on apprend à reconnaître, pas le libellé.
    expect(shapeFor({ id: "n-importe-quoi", shape: "capsule" })).toBe("capsule");
  });

  it("chaque projet d'amorçage a une teinte distincte", () => {
    const tints = SEED_PROJECTS.map((p) => p.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });

  it("couvre 40 couples teinte+forme avant de se répéter", () => {
    // C'est la promesse qui remplace le plafond de cinq projets : si le calcul
    // dégénère (par exemple teinte et forme dérivées du même rang de hachage),
    // le nombre de couples uniques s'effondre et ce test le dit.
    const couples = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const id = `projet-${i}`;
      couples.add(`${tintFromId(id)}-${shapeFromId(id)}`);
    }
    expect(couples.size).toBe(40);
  });
});

describe("fallbackProjectId", () => {
  it("se rabat sur le premier projet de la liste", () => {
    expect(fallbackProjectId(SEED_PROJECTS)).toBe(SEED_PROJECTS[0].id);
  });

  it("renvoie une chaîne vide sans aucun projet, jamais un id inventé", () => {
    // Un identifiant fabriqué pointerait vers un projet fantôme : l'item
    // paraîtrait rangé alors qu'il n'existe nulle part. Vide = orphelin, et un
    // orphelin s'affiche sous « Autre » dans l'écran Tâches.
    expect(fallbackProjectId([])).toBe("");
  });
});

describe("création d'un projet", () => {
  it("dérive un identifiant lisible et sans accents", () => {
    expect(slugify("Web@cadémie")).toBe("web-cademie");
    expect(slugify("  La Table de Paupy  ")).toBe("la-table-de-paupy");
  });

  it("ne rend jamais un identifiant vide, même sans caractère latin", () => {
    // Un id vide entrerait en collision avec le repli « aucun projet ».
    expect(slugify("日本")).not.toBe("");
  });

  it("désambiguïse un identifiant déjà pris", () => {
    const taken = new Set(["sport"]);
    expect(uniqueProjectId("Sport", taken)).toBe("sport-2");
  });

  it("attribue la teinte et la forme les MOINS utilisées", () => {
    // Sans ça, deux projets créés à la suite se ressembleraient, ce qui ruine
    // la lecture de l'écran Tâches — on reconnaît le couple, pas le libellé.
    const existing = [
      { tint: 1 as const, shape: "square" as const },
      { tint: 2 as const, shape: "diamond" as const },
    ];
    const skin = nextSkin(existing);
    expect(skin.tint).not.toBe(1);
    expect(skin.tint).not.toBe(2);
    expect(skin.shape).not.toBe("square");
    expect(skin.shape).not.toBe("diamond");
  });

  it("reste défini quand les huit teintes sont déjà prises", () => {
    const full = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => ({ tint: t as Tint }));
    const skin = nextSkin(full);
    expect(skin.tint).toBeGreaterThanOrEqual(1);
    expect(skin.tint).toBeLessThanOrEqual(8);
  });
});

describe("sélecteurs d'échéance", () => {
  /**
   * Non-régression du 2026-08-14 : « Pas d'échéance » était injouable.
   *
   * Les deux `<select>` d'échéance (fiche et revue) sont verrouillés sur
   * `value=""` — c'est ce qui permet de rejouer deux fois de suite le même
   * choix. Une option portant elle aussi `""` ne déclenche donc jamais
   * `change` : effacer une échéance devenait impossible, et une échéance posée
   * par erreur était définitive.
   *
   * Le défaut n'est pas testable sans DOM ; sa cause, si.
   */
  it("aucune suggestion ne porte la chaîne vide", () => {
    expect(DUE_SUGGESTIONS).not.toContain("");
    expect(DUE_SUGGESTIONS.every((s) => s.trim().length > 0)).toBe(true);
  });

  it("la valeur d'effacement est distincte de toute suggestion", () => {
    expect(DUE_CLEAR).not.toBe("");
    expect(DUE_SUGGESTIONS).not.toContain(DUE_CLEAR);
  });

  it("la valeur d'effacement n'est pas une échéance lisible", () => {
    // Si `DUE_CLEAR` devenait un libellé reconnu, le choix « Pas d'échéance »
    // poserait une date au lieu de l'effacer.
    expect(resolveDue(DUE_CLEAR)).toBeNull();
  });
});
