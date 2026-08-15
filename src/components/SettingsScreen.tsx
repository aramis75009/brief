"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, ProjectDot, TrashIcon } from "./icons";
import {
  disablePush,
  enablePush,
  readPushState,
  sendTestPush,
  type PushState,
} from "@/lib/push-client";
import { shapeFor, skinFor } from "@/lib/projects";
import type { Item, Project, Shape, Tint } from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-1 mt-5 mb-2.5 flex items-center gap-2">
      <span className="text-11 font-semibold tracking-[1.2px] text-ink-3 uppercase">{children}</span>
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
    </div>
  );
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function SettingsScreen({
  projects,
  items,
  reloading,
  onReloadProjects,
  onCreateProject,
  onDeleteProject,
  onClearSession,
  onLock,
}: {
  projects: Project[];
  items: Item[];
  reloading: boolean;
  onReloadProjects: () => void;
  onCreateProject: (name: string, tint?: Tint, shape?: Shape) => Promise<string | null>;
  onDeleteProject: (id: string) => Promise<string | null>;
  onClearSession: () => void;
  onLock: () => void;
}) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newTint, setNewTint] = useState<Tint>(1);
  const [newShape, setNewShape] = useState<Shape>("disc");
  const [addingProject, setAddingProject] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);

  // Gestion des notifications
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [testPushBusy, setTestPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const refreshPush = useCallback(() => {
    void readPushState().then(setPushState);
  }, []);

  useEffect(refreshPush, [refreshPush]);

  const togglePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (pushState?.status === "on") {
        await disablePush();
        setPushMessage("Notifications désactivées.");
      } else {
        await enablePush(VAPID_PUBLIC_KEY);
        setPushMessage("Notifications activées !");
      }
      refreshPush();
    } catch (e) {
      setPushMessage(e instanceof Error ? e.message : "Échec de modification.");
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setTestPushBusy(true);
    setPushMessage(null);
    try {
      await sendTestPush();
      setPushMessage("Notification de test envoyée !");
    } catch (e) {
      setPushMessage(e instanceof Error ? e.message : "Échec de l'envoi test.");
    } finally {
      setTestPushBusy(false);
    }
  };

  // Exportation des données en JSON
  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      projects,
      items,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brief-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateProject(newProjectName.trim(), newTint, newShape);
      setNewProjectName("");
      setAddingProject(false);
    } finally {
      setCreating(false);
    }
  };

  const isPushActive = pushState?.status === "on";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-[26px] pt-2 pb-1">
        <h1 className="m-0 text-27 font-bold tracking-tight text-ink">Réglages</h1>
        <p className="mt-0.5 mb-0 text-13 font-normal text-ink-2">
          Gestion des projets, synchronisation et préférences
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-2 pb-6">
        {/* Section 1 : Projets */}
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Projets ({projects.length})</SectionLabel>
          <button
            type="button"
            onClick={() => setAddingProject(!addingProject)}
            className="flex h-7 items-center gap-1 cursor-pointer rounded-chip border-none px-2.5 text-11 font-semibold text-white transition-transform active:scale-95"
            style={{ background: "var(--color-action)" }}
          >
            <PlusIcon size={13} />
            Nouveau
          </button>
        </div>

        {/* Formulaire de création de projet */}
        {addingProject && (
          <form
            onSubmit={handleCreateProjectSubmit}
            className="mb-3.5 rounded-tile border bg-tile p-4 shadow-[var(--e1)] animate-br-in"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="block text-11 font-bold tracking-wider text-ink-3 uppercase mb-2">
              Créer un projet
            </span>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nom du projet (ex: Freelance, Maison...)"
              className="w-full rounded-field border bg-page px-3 py-2 text-14 font-medium text-ink placeholder:text-ink-3 focus:outline-none"
              style={{ borderColor: "var(--line-2)" }}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Choix de teinte */}
                <select
                  value={newTint}
                  onChange={(e) => setNewTint(Number(e.target.value) as Tint)}
                  className="h-8 rounded-chip border bg-page px-2 text-11 font-semibold text-ink focus:outline-none"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  <option value={1}>Lilas (p1)</option>
                  <option value={2}>Ardoise (p2)</option>
                  <option value={3}>Sauge (p3)</option>
                  <option value={4}>Sable (p4)</option>
                  <option value={5}>Argile (p5)</option>
                  <option value={6}>Acier (p6)</option>
                  <option value={7}>Lin (p7)</option>
                  <option value={8}>Glacier (p8)</option>
                </select>

                {/* Choix de forme */}
                <select
                  value={newShape}
                  onChange={(e) => setNewShape(e.target.value as Shape)}
                  className="h-8 rounded-chip border bg-page px-2 text-11 font-semibold text-ink focus:outline-none"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  <option value="disc">Disque ●</option>
                  <option value="square">Carré ■</option>
                  <option value="diamond">Losange ◆</option>
                  <option value="ring">Anneau ◯</option>
                  <option value="capsule">Pilule ⬭</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingProject(false)}
                  className="h-8 cursor-pointer rounded-chip border-none bg-transparent px-2.5 text-12 font-medium text-ink-3"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || creating}
                  className="h-8 cursor-pointer rounded-chip border-none px-3.5 text-12 font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: "var(--color-action)" }}
                >
                  {creating ? "Création…" : "Ajouter"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Liste des projets */}
        <div className="flex flex-col gap-2 mb-4">
          {projects.map((p) => {
            const skin = skinFor(p);
            const count = items.filter((i) => i.projectId === p.id && !i.doneAt).length;
            const isDeleting = busyProjectId === p.id;

            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-row border bg-tile px-4 py-3 shadow-[var(--e1)]"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-6 items-center gap-1.5 rounded-chip px-2 text-12 font-semibold"
                    style={{ background: skin.bg, color: skin.fg }}
                  >
                    <ProjectDot shape={shapeFor(p)} />
                    {p.name}
                  </span>
                  <span className="text-11 font-medium text-ink-3">
                    {count} tâche{count > 1 ? "s" : ""}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isDeleting || projects.length <= 1}
                  onClick={() => {
                    if (confirm(`Supprimer le projet « ${p.name} » ? Ses tâches basculeront sur le projet par défaut.`)) {
                      setBusyProjectId(p.id);
                      void onDeleteProject(p.id).finally(() => setBusyProjectId(null));
                    }
                  }}
                  title="Supprimer ce projet"
                  aria-label={`Supprimer ${p.name}`}
                  className="cursor-pointer border-none bg-transparent p-1 text-ink-3 transition-colors hover:text-error disabled:opacity-30"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Bouton pour recharger les projets depuis le serveur */}
        <button
          type="button"
          disabled={reloading}
          onClick={onReloadProjects}
          className="mb-4 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-chip border border-[var(--line-2)] bg-page text-12 font-semibold text-ink transition-transform active:scale-95 disabled:opacity-50"
        >
          {reloading ? "Synchronisation en cours…" : "↻ Forcer la synchronisation des projets"}
        </button>

        {/* Section 2 : Notifications & Rappels */}
        <SectionLabel>Notifications Web Push</SectionLabel>
        <div className="rounded-tile border bg-tile p-4 shadow-[var(--e1)] mb-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="m-0 text-15 font-semibold text-ink">Rappels en temps réel</p>
              <p className="mt-0.5 mb-0 text-11 text-ink-2">
                {isPushActive
                  ? "Actives sur cet appareil (serveur VPS connecté)"
                  : "Inactives — active-les pour recevoir les rappels"}
              </p>
            </div>
            <span
              className="rounded-chip px-2.5 py-1 text-11 font-bold"
              style={{
                background: isPushActive ? "var(--color-p3)" : "var(--color-p4)",
                color: isPushActive ? "var(--color-p3-ink)" : "var(--color-p4-ink)",
              }}
            >
              {isPushActive ? "ON" : "OFF"}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void togglePush()}
              className="flex-1 h-9 cursor-pointer rounded-chip border-none px-3 text-12 font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              style={{ background: isPushActive ? "var(--color-ink)" : "var(--color-action)" }}
            >
              {pushBusy ? "Traitement…" : isPushActive ? "Désactiver" : "Activer les rappels"}
            </button>

            {isPushActive && (
              <button
                type="button"
                disabled={testPushBusy}
                onClick={() => void testPush()}
                className="h-9 cursor-pointer rounded-chip border border-[var(--line-2)] bg-page px-3 text-12 font-semibold text-ink transition-transform active:scale-95 disabled:opacity-50"
              >
                {testPushBusy ? "Envoi…" : "Tester 🔔"}
              </button>
            )}
          </div>

          {pushMessage && (
            <p className="mt-2.5 mb-0 text-12 font-semibold text-action">{pushMessage}</p>
          )}
        </div>

        {/* Section 3 : Sauvegarde & Sécurité */}
        <SectionLabel>Sauvegarde & Sécurité</SectionLabel>
        <div className="rounded-tile border bg-tile p-4 shadow-[var(--e1)] mb-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleExportData}
              className="flex h-10 w-full cursor-pointer items-center justify-between rounded-row border border-[var(--line)] bg-page px-4 text-13 font-semibold text-ink transition-transform active:scale-98"
            >
              <span>Exporter mes données en JSON</span>
              <span className="text-11 text-ink-3">Télécharger 💾</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm("Vider la session locale ? (Les données sur le VPS restent intactes)")) {
                  onClearSession();
                }
              }}
              className="flex h-10 w-full cursor-pointer items-center justify-between rounded-row border border-[var(--line)] bg-page px-4 text-13 font-semibold text-error transition-transform active:scale-98"
            >
              <span>Vider le cache local</span>
              <span className="text-11 text-error opacity-70">Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Verrouiller l'application */}
        <button
          type="button"
          onClick={onLock}
          className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-tile border-none bg-ink text-14 font-semibold text-page shadow-[var(--e2)] transition-transform active:scale-95"
        >
          Verrouiller l&apos;application 🔒
        </button>
      </div>
    </div>
  );
}
