import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAuthorizedUserIds } from "./admin";

const select = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: () => ({ select }) })),
}));

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "cle-service-role";
});

afterEach(() => {
  delete process.env.SUPABASE_SECRET_KEY;
  select.mockReset();
});

describe("listAuthorizedUserIds", () => {
  it("rend les identifiants des comptes autorisés", async () => {
    select.mockResolvedValueOnce({
      data: [{ user_id: UUID_A }, { user_id: UUID_B }],
      error: null,
    });
    expect(await listAuthorizedUserIds()).toEqual([UUID_A, UUID_B]);
  });

  it("écarte une ligne dont l'identifiant n'est pas un UUID", async () => {
    // Ces identifiants servent à construire des chemins de fichiers : une ligne
    // aberrante ferait lever `storeForUser` AU MILIEU d'un passage de cron,
    // interrompant les comptes suivants.
    select.mockResolvedValueOnce({
      data: [{ user_id: UUID_A }, { user_id: "../../etc" }, { user_id: null }],
      error: null,
    });
    expect(await listAuthorizedUserIds()).toEqual([UUID_A]);
  });

  it("rend une liste vide quand il n'y a aucun compte", async () => {
    select.mockResolvedValueOnce({ data: [], error: null });
    expect(await listAuthorizedUserIds()).toEqual([]);
  });

  it("lève un message explicite si SUPABASE_SECRET_KEY manque", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(listAuthorizedUserIds()).rejects.toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("lève quand Supabase répond une erreur — jamais une liste vide silencieuse", async () => {
    // Rendre `[]` ici ferait passer un cron pour « aucun compte à traiter » :
    // les rappels de tout le monde s'arrêteraient sans qu'aucune alerte ne parte.
    select.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    await expect(listAuthorizedUserIds()).rejects.toThrow(/permission denied/);
  });
});
