# Email + Password Auth (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Brief's single shared PIN (`BRIEF_PIN`, `src/lib/guard.ts`) with per-user email + password authentication via Supabase Auth, across all 18 `/api/*` routes and the client-side gate screen.

**Architecture:** Supabase Auth owns password hashing and session issuance (JWT access + httpOnly refresh cookie). A Postgres table `authorized_users` is Brief's own allow-list (gates who is ever allowed to sign in, holds `display_name`/`last_login_at`). `src/lib/guard.ts` changes from comparing a PIN header to verifying a Supabase session (`requireSession()`, local JWT verification — no network round-trip per request). `src/proxy.ts` (Next 16's renamed `middleware.ts`) refreshes the session cookie on every request before route handlers run.

**Tech Stack:** Next.js 16.3.0 (App Router, `proxy.ts` not `middleware.ts`), React 19, `@supabase/supabase-js` + `@supabase/ssr`, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-26-email-password-auth-design.md`

## Global Constraints

- **No `service_role` key anywhere in app code.** All Supabase calls use the publishable (anon-equivalent) key + RLS. Adding an authorized user is a manual SQL insert by Aramis (spec's Migration section).
- **Machine token routes are out of scope and must not be touched:** `/api/cron/reminders`, `/api/capture`, `/api/digest`, `/api/cron/caldav-sync` keep `requireMachineToken` from `src/lib/cron-auth.ts` unchanged.
- **No data isolation.** `items.json` stays shared across all authorized users (spec's Non-goals).
- **`cookies()` from `next/headers` is async in this Next version** — always `await cookies()`. Never use `middleware.ts`; the file is `src/proxy.ts` exporting `proxy(request: NextRequest)` (Next 16 renamed Middleware to Proxy — confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
- **Anti-enumeration:** `/api/auth/login` returns the same generic message whether the email is unknown or the password is wrong. `/api/auth/forgot-password` always returns the same generic success message, even on internal failure.
- **Commit after every task**, on branch `feat/email-password-auth`.
- Run `npx vitest run`, `npx tsc --noEmit`, `npx eslint .` at the end of every task — not just once at the end of the plan.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/supabase/server.ts` | One shared factory: builds the server-side Supabase client bound to the request's cookies. Used by `guard.ts` and every `/api/auth/*` route. |
| `supabase/migrations/0001_authorized_users.sql` | Versioned DDL for the allow-list table (applied by hand in the Supabase SQL editor — no CI/local Postgres in this repo). |
| `src/lib/guard.ts` | `requireSession()` replaces `requirePin()`. Verifies the JWT locally via `getClaims()`. |
| `src/app/api/auth/login/route.ts` | `signInWithPassword` + `authorized_users` check. |
| `src/app/api/auth/logout/route.ts` | `signOut`. |
| `src/app/api/auth/forgot-password/route.ts` | `resetPasswordForEmail`, always-generic response. |
| `src/app/api/auth/session/route.ts` | Bootstrap check the client calls on mount (replaces `src/app/api/session/route.ts`, deleted). |
| `src/proxy.ts` | Refreshes the Supabase session cookie on every request, before route handlers run. |
| `src/lib/api.ts` | Drops PIN header injection; gains `UnauthorizedError` (moved from `pin.ts`). |
| `src/components/AuthGate.tsx` | Replaces `PinGate.tsx` — the approved mockup (`https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456`), ported to React/Tailwind. |
| `src/lib/pin.ts` | **Deleted** at the end (Task 13), once nothing imports it. |

---

### Task 1: Supabase client dependency and server-side client factory

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `src/lib/supabase/server.ts`
- Test: `src/lib/supabase/server.test.ts`
- Modify: `.env.example`, `.env.production.example`

**Interfaces:**
- Produces: `getSupabaseServerClient(): Promise<SupabaseClient>` — every later task that talks to Supabase from the server calls this.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/supabase/server.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

describe("getSupabaseServerClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws a clear error when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabaseServerClient } = await import("./server");
    await expect(getSupabaseServerClient()).rejects.toThrow(/SUPABASE/);
  });

  it("builds a client when env vars are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxx");
    const { getSupabaseServerClient } = await import("./server");
    const client = await getSupabaseServerClient();
    expect(client.auth).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run src/lib/supabase/server.test.ts`
Expected: FAIL — `Cannot find module './server'`

- [ ] **Step 4: Implement**

```ts
// src/lib/supabase/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Un seul facteur de client Supabase côté serveur, partagé par requireSession()
 * et les routes /api/auth/*. setAll() écrit les cookies quand c'est possible
 * (Route Handler) et ne fait rien silencieusement sinon (Server Component en
 * lecture seule) — src/proxy.ts rafraîchit la session sur chaque requête, donc
 * l'écriture ici est une optimisation, jamais une nécessité.
 */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes côté serveur.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* contexte lecture-seule — proxy.ts gère le rafraîchissement */
        }
      },
    },
  });
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run src/lib/supabase/server.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Document the new env vars**

Add to both `.env.example` and `.env.production.example` (near the other `NEXT_PUBLIC_*` vars, with the same "build-time, not runtime" warning style already used for the VAPID key in that file):

```
# Supabase (auth email + mot de passe) — build-time, comme la clé VAPID :
# absentes au build, undefined dans le bundle navigateur.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/supabase/server.ts src/lib/supabase/server.test.ts .env.example .env.production.example
git commit -m "feat: add Supabase server client factory"
```

---

### Task 2: Postgres schema — `authorized_users`

**Files:**
- Create: `supabase/migrations/0001_authorized_users.sql`
- Test: `src/lib/supabase/schema.test.ts` (smoke test — no CI Postgres available, this only guards against the file being corrupted or deleted, it does not verify the SQL runs)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/supabase/schema.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  new URL("../../../supabase/migrations/0001_authorized_users.sql", import.meta.url),
  "utf-8",
);

describe("0001_authorized_users.sql", () => {
  it("creates the table keyed on auth.users(id)", () => {
    expect(SQL).toMatch(/create table public\.authorized_users/);
    expect(SQL).toMatch(/references auth\.users\(id\)/);
  });

  it("enables and scopes RLS with auth.uid() wrapped in a select", () => {
    expect(SQL).toMatch(/enable row level security/);
    expect(SQL).toMatch(/\(select auth\.uid\(\)\)/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/supabase/schema.test.ts`
Expected: FAIL — `ENOENT` (file doesn't exist)

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0001_authorized_users.sql
create table public.authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.authorized_users enable row level security;

-- auth.uid() enveloppé dans (select ...) : évalué une fois par requête, pas
-- une fois par ligne (skill supabase-postgres-best-practices,
-- "Optimize RLS Policies for Performance").
create policy "read own row"
  on public.authorized_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/supabase/schema.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_authorized_users.sql src/lib/supabase/schema.test.ts
git commit -m "feat: add authorized_users schema migration"
```

- [ ] **Step 6: MANUAL — flag for Aramis, do not attempt from the agent session**

This step needs a live Supabase project and cannot be done by the coding agent. Leave this checklist item unchecked and tell Aramis directly:

1. Create the Supabase project (dashboard).
2. Authentication → Providers: enable Email, **disable** every other provider (no SSO), password sign-in only.
3. SQL Editor: paste and run `supabase/migrations/0001_authorized_users.sql`.
4. Authentication → Users → Add user: create Aramis's own account (email + password).
5. SQL Editor: `insert into authorized_users (user_id) values ('<the uuid shown for that user>');`
6. Verify: `select * from authorized_users;` returns exactly one row.

---

### Task 3: `guard.ts` — `requireSession()` replaces `requirePin()`

**Files:**
- Modify: `src/lib/guard.ts` (full rewrite)
- Test: `src/lib/guard.test.ts` (new)

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from Task 1.
- Produces: `requireSession(): Promise<Response | null>` — every route in Task 4 and `src/app/api/auth/session/route.ts` (Task 8) call this.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/guard.test.ts
import { describe, expect, it, vi } from "vitest";
import { requireSession } from "./guard";

const getClaims = vi.fn();

vi.mock("./supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

describe("requireSession", () => {
  it("renvoie null quand la session est valide", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } }, error: null });
    expect(await requireSession()).toBeNull();
  });

  it("renvoie 401 quand il n'y a pas de session", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "no session" } });
    const res = await requireSession();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/guard.test.ts`
Expected: FAIL — `requireSession` is not exported (old file only exports `requirePin`)

- [ ] **Step 3: Rewrite guard.ts**

```ts
// src/lib/guard.ts
import "server-only";
import { getSupabaseServerClient } from "./supabase/server";

/**
 * Garde d'accès SERVEUR pour toutes les routes /api/*.
 *
 * Remplace requirePin() (PIN partagé unique) : vérifie une session Supabase
 * Auth. getClaims() valide le JWT localement (clé publique du projet, ES256)
 * — pas d'appel réseau à Supabase à chaque requête ; le rafraîchissement du
 * jeton, quand il est nécessaire, est géré par src/proxy.ts avant que la
 * route ne s'exécute.
 *
 * Toute nouvelle route sous /api/ DOIT commencer par :
 *   const denied = await requireSession();
 *   if (denied) return denied;
 */
export async function requireSession(): Promise<Response | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  return null;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/guard.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/guard.ts src/lib/guard.test.ts
git commit -m "feat: replace requirePin with requireSession"
```

*(Note: this commit temporarily breaks every route still calling `requirePin` — Task 4 fixes all call sites immediately after. Do not push between these two tasks.)*

---

### Task 4: Migrate the 17 existing routes from `requirePin` to `requireSession`

**Files:** all of the following (every occurrence of the guard call, some files have more than one handler):

```
src/app/api/agenda/route.ts
src/app/api/audio/[id]/route.ts
src/app/api/audio/route.ts
src/app/api/board/route.ts
src/app/api/caldav-status/route.ts
src/app/api/chat/route.ts
src/app/api/items/[id]/route.ts
src/app/api/items/route.ts
src/app/api/overview/route.ts
src/app/api/parse/route.ts
src/app/api/projects/route.ts
src/app/api/push/subscribe/route.ts
src/app/api/push/test/route.ts
src/app/api/search/route.ts
src/app/api/tags/[id]/route.ts
src/app/api/tags/route.ts
src/app/api/transcribe/route.ts
```

(`src/app/api/session/route.ts` is NOT in this list — it's deleted in Task 8, not migrated.)

**Interfaces:**
- Consumes: `requireSession()` from Task 3.

- [ ] **Step 1: Apply the mechanical transform to every file above**

The change is textually identical everywhere: the import, and every `const denied = requirePin(req);` line.

```bash
FILES=(
  src/app/api/agenda/route.ts
  "src/app/api/audio/[id]/route.ts"
  src/app/api/audio/route.ts
  src/app/api/board/route.ts
  src/app/api/caldav-status/route.ts
  src/app/api/chat/route.ts
  "src/app/api/items/[id]/route.ts"
  src/app/api/items/route.ts
  src/app/api/overview/route.ts
  src/app/api/parse/route.ts
  src/app/api/projects/route.ts
  src/app/api/push/subscribe/route.ts
  src/app/api/push/test/route.ts
  src/app/api/search/route.ts
  "src/app/api/tags/[id]/route.ts"
  src/app/api/tags/route.ts
  src/app/api/transcribe/route.ts
)
for f in "${FILES[@]}"; do
  sed -i '' \
    -e 's/import { requirePin } from "@\/lib\/guard";/import { requireSession } from "@\/lib\/guard";/' \
    -e 's/const denied = requirePin(req);/const denied = await requireSession();/' \
    "$f"
done
```

(macOS/BSD `sed`, matching this repo's environment — `-i ''` with an explicit empty backup suffix.)

- [ ] **Step 2: Verify no `requirePin` reference remains outside guard's own history**

```bash
grep -rn "requirePin" src/app/api
```

Expected: no output. If anything prints, the sed above missed a file — check for a variant import line and fix it by hand.

- [ ] **Step 3: Lint — catch any `req` parameter left unused**

```bash
npx eslint .
```

Some `GET` handlers only used `req` for the old `requirePin(req)` call and now have an unused parameter. For each one ESLint flags, rename the parameter to `_req` in that file's handler signature (e.g. `export async function GET(_req: Request)`), keeping the rest of the function untouched. Do not delete the parameter — Next.js route handler signatures are positional.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both clean. (No existing test currently imports `requirePin` directly — confirmed by `grep -rl "requirePin" src --include="*.test.ts"` returning nothing before this task.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api
git commit -m "feat: migrate all API routes to requireSession"
```

---

### Task 5: `POST /api/auth/login`

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Test: `src/app/api/auth/login/route.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from Task 1.
- Produces: `POST /api/auth/login` — consumed by `AuthGate.tsx` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/auth/login/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const update = vi.fn();

function makeQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle,
    update: vi.fn((patch: unknown) => {
      update(patch);
      return builder;
    }),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
    from: vi.fn(() => makeQueryBuilder()),
  })),
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("401 générique si email ou mot de passe manquant", async () => {
    const res = await POST(req({ email: "" }));
    expect(res.status).toBe(401);
  });

  it("401 générique si signInWithPassword échoue", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(401);
  });

  it("403 et déconnexion si l'email n'est pas dans authorized_users", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(403);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("200 et met à jour last_login_at si autorisé", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { user_id: "u1" } });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login_at: expect.any(String) }),
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/api/auth/login/route.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```ts
// src/app/api/auth/login/route.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  const { data: allowed } = await supabase
    .from("authorized_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return Response.json({ error: "Compte non autorisé." }, { status: 403 });
  }

  await supabase
    .from("authorized_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", data.user.id);

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/app/api/auth/login/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/login
git commit -m "feat: add POST /api/auth/login"
```

---

### Task 6: `POST /api/auth/logout`

**Files:**
- Create: `src/app/api/auth/logout/route.ts`
- Test: `src/app/api/auth/logout/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/auth/logout/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { signOut } })),
}));

describe("POST /api/auth/logout", () => {
  it("appelle signOut et renvoie ok", async () => {
    const res = await POST();
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/api/auth/logout/route.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```ts
// src/app/api/auth/logout/route.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/app/api/auth/logout/route.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/logout
git commit -m "feat: add POST /api/auth/logout"
```

---

### Task 7: `POST /api/auth/forgot-password`

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`
- Test: `src/app/api/auth/forgot-password/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/auth/forgot-password/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { resetPasswordForEmail } })),
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  it("400 si l'email est absent", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("réponse générique quand resetPasswordForEmail réussit", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/Si ce compte existe/);
  });

  it("même réponse générique quand resetPasswordForEmail échoue", async () => {
    resetPasswordForEmail.mockRejectedValueOnce(new Error("network down"));
    const res = await POST(req({ email: "unknown@b.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/Si ce compte existe/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/api/auth/forgot-password/route.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```ts
// src/app/api/auth/forgot-password/route.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE = "Si ce compte existe, un lien de réinitialisation vient d'être envoyé.";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { email } = (body ?? {}) as { email?: unknown };
  if (typeof email !== "string" || !email.trim()) {
    return Response.json({ error: "Adresse email requise." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  try {
    await supabase.auth.resetPasswordForEmail(email.trim());
  } catch {
    /* réponse toujours générique — ne jamais indiquer si l'email existe */
  }

  return Response.json({ ok: true, message: GENERIC_MESSAGE });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/app/api/auth/forgot-password/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/forgot-password
git commit -m "feat: add POST /api/auth/forgot-password"
```

---

### Task 8: `GET /api/auth/session` (client bootstrap check) and delete the old PIN session route

**Files:**
- Create: `src/app/api/auth/session/route.ts`
- Delete: `src/app/api/session/route.ts`
- Test: `src/app/api/auth/session/route.test.ts`

**Interfaces:**
- Consumes: `requireSession()` from Task 3.
- Produces: `GET /api/auth/session` → `200 {authenticated:true}` or the 401 from `requireSession()` — consumed by `BriefApp.tsx` (Task 12) to decide the initial `unlocked` state, since an httpOnly cookie can't be read from client JS the way `getPin()` used to be.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/auth/session/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const requireSession = vi.fn();

vi.mock("@/lib/guard", () => ({ requireSession }));

describe("GET /api/auth/session", () => {
  it("200 authenticated quand la session est valide", async () => {
    requireSession.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true });
  });

  it("propage le 401 de requireSession", async () => {
    requireSession.mockResolvedValueOnce(Response.json({ error: "x" }, { status: 401 }));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/app/api/auth/session/route.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement, and delete the old route**

```ts
// src/app/api/auth/session/route.ts
import { requireSession } from "@/lib/guard";

export async function GET(): Promise<Response> {
  const denied = await requireSession();
  if (denied) return denied;
  return Response.json({ authenticated: true });
}
```

```bash
rm src/app/api/session/route.ts
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/app/api/auth/session/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A src/app/api/auth/session src/app/api/session
git commit -m "feat: add GET /api/auth/session, remove old PIN session route"
```

---

### Task 9: `src/proxy.ts` — refresh the session on every request

**Files:**
- Create: `src/proxy.ts`
- Test: `src/proxy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/proxy.test.ts
import { describe, expect, it } from "vitest";
import { config } from "./proxy";

describe("proxy config", () => {
  it("exclut les assets statiques et le favicon du matcher", () => {
    const [pattern] = config.matcher;
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/proxy.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```ts
// src/proxy.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête, AVANT que la route ne
 * s'exécute — sans ça, un jeton d'accès expiré ferait échouer requireSession()
 * une fois par heure au lieu d'être renouvelé silencieusement en arrière-plan.
 *
 * Ne remplace PAS requireSession() : chaque route reste responsable de sa
 * propre vérification. La doc Next.js sur le proxy le dit explicitement — un
 * changement de matcher ne doit jamais devenir un trou de sécurité silencieux.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/proxy.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat: add proxy.ts to refresh Supabase session on every request"
```

---

### Task 10: `src/lib/api.ts` — drop PIN header injection, add `UnauthorizedError`

**Files:**
- Modify: `src/lib/api.ts`
- Test: `src/lib/api.test.ts` (new)

**Interfaces:**
- Produces: `UnauthorizedError` (moved here from `pin.ts`), `apiFetch()` (simplified — no more manual header, cookies follow same-origin requests automatically).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, UnauthorizedError } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lève UnauthorizedError sur 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(apiFetch("/api/items")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("renvoie la réponse telle quelle si ce n'est pas 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const res = await apiFetch("/api/items");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/lib/api.test.ts`
Expected: FAIL — `apiFetch`/`UnauthorizedError` not exported from `./api` yet

- [ ] **Step 3: Edit `src/lib/api.ts`**

Replace the top of the file (currently `import { PIN_HEADER, UnauthorizedError, clearPin, getPin } from "./pin";` at line 3) with:

```ts
"use client";

import type { AgendaItem } from "./agenda";
import type { DraftItem, Item, KanbanBoard, Overview, Project, SaveResult, Tag } from "./types";

/** Erreur porteuse d'un message déjà lisible en français. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** 401 : session absente ou expirée — l'appelant doit réafficher AuthGate. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Session expirée");
    this.name = "UnauthorizedError";
  }
}

/** fetch vers /api/* — les cookies de session suivent automatiquement (same-origin). */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) throw new UnauthorizedError();
  return res;
}
```

Replace `jsonFetch` (currently reading `getPin()`/`PIN_HEADER` and calling `clearPin()` on 401):

```ts
async function jsonFetch<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const headers = new Headers(init.headers);
  // Ne PAS forcer Content-Type sur FormData : le navigateur doit set
  // multipart/form-data avec son boundary. Forcer application/json casse l'upload.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ApiError("Le serveur n'a pas répondu à temps. Réessaie.");
    }
    throw new ApiError("Réseau indisponible. Vérifie ta connexion.");
  }

  if (res.status === 401) {
    throw new UnauthorizedError();
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && res.status !== 207) {
    throw new ApiError(data.error || `Le serveur a répondu ${res.status}.`);
  }
  return data;
}
```

In `transcribeAudio`'s XHR block, remove the two lines reading the PIN header:

```diff
-    const pin = getPin();
-    if (pin) xhr.setRequestHeader(PIN_HEADER, pin);
-
     xhr.upload.onload = () => onUploaded();
```

and simplify its 401 branch:

```diff
       if (xhr.status === 401) {
-        clearPin();
         reject(new UnauthorizedError());
         return;
       }
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/lib/api.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Full suite check (this file is imported by most of the app)**

```bash
npx tsc --noEmit
```

Expected: still fails at this point — `src/components/BriefApp.tsx`, `AgendaScreen.tsx`, `desktop/DesktopCalendar.tsx` still import `UnauthorizedError` from `@/lib/pin` (which still re-exports it fine, since `pin.ts` isn't deleted until Task 13) — so this should actually be clean already. If `tsc` reports anything about `api.ts`, fix it now; leave any remaining `pin.ts`-related errors for Task 13.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/lib/api.test.ts
git commit -m "feat: drop PIN header injection from api.ts, move UnauthorizedError here"
```

---

### Task 11: `AuthGate.tsx` — port the approved mockup

**Files:**
- Create: `src/components/AuthGate.tsx`

**Interfaces:**
- Consumes: `apiFetch` is NOT used here (login must work before any session exists) — plain `fetch` to `/api/auth/login` and `/api/auth/forgot-password`.
- Produces: `AuthGate({ onUnlocked }: { onUnlocked: () => void })` — same prop signature as the `PinGate` it replaces, so `BriefApp.tsx` (Task 12) only swaps the import and JSX tag.

**Design reference:** the approved mockup at `https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456` (email + password, animated three-bar mark). Verified against the live design system:
- Colors confirmed present in `src/app/globals.css`: `--color-bg`, `--color-surface`, `--color-ink`, `--color-ink-muted`, `--color-ink-faint`, `--color-danger`.
- **Do not** copy `PinGate.tsx`'s inline `style={{ background: "var(--color-page)" }}` / `var(--line-2)` / `var(--color-action)` / `var(--e1)` / `var(--e2)` tokens — none of these exist in `globals.css` (confirmed by grep). They're a stale leftover from before the Claude Design v1 rewrite; flag this to Aramis as a pre-existing bug in `PinGate.tsx` (which this task deletes anyway in Task 12) rather than fixing it.
- The pop-in stagger animation matches the existing convention in `src/components/CaptureSheet.tsx:362-363` — inline `style={{ animation: "pop .45s cubic-bezier(.2,.9,.3,1) both", animationDelay: ... }}`, not a Tailwind utility class.
- **Layout mechanism differs from the raw mockup HTML on purpose:** the mockup used a CSS `@media (max-width: 860px)` breakpoint because it was a standalone page. Inside Brief, `PhoneFrame` (see `src/components/PhoneFrame.tsx`) already constrains the mobile layout to a fixed 390px-wide box using Tailwind's `sm:` breakpoint (≥640px) — so a `max-width` media query on `AuthGate` itself would read the *browser viewport*, not the 390px box it's actually rendered in, and would incorrectly apply the desktop split layout while squeezed inside the phone frame on any browser window between 640px and 1024px wide. Instead, `AuthGate` takes an explicit `desktop: boolean` prop (driven by `useIsDesktop()` in `BriefApp.tsx`, threshold 1024px — see `src/lib/useIsDesktop.ts`) and switches its Tailwind classes on that prop, not on a media query. Same visual result, correct in both contexts.

- [ ] **Step 1: Implement**

```tsx
// src/components/AuthGate.tsx
"use client";

import { useCallback, useState } from "react";

type Step = "login" | "forgot" | "success";

const DEMO_NOTE = null; // pas de mode démo en prod — la maquette en avait un, pas le composant réel.

function Mark() {
  const bars = [
    { fill: "var(--color-task-100, #CFE0FF)", w: 100 },
    { fill: "var(--color-meet-100, #CBE9D6)", w: 76 },
    { fill: "var(--color-idea-100, #FBE2AE)", w: 52 },
  ];
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {bars.map((bar, i) => (
        <span
          key={i}
          className="block h-[19px] rounded-full"
          style={{
            width: `${bar.w}px`,
            background: bar.fill,
            transformOrigin: "left center",
            animation: "pop .45s cubic-bezier(.2,.9,.3,1) both",
            animationDelay: `${0.05 + i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export function AuthGate({
  onUnlocked,
  desktop = false,
}: {
  onUnlocked: () => void;
  desktop?: boolean;
}) {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!email.trim() || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        setStep("success");
        onUnlocked();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Email ou mot de passe incorrect.");
    } catch {
      setError("Serveur injoignable. Réessaie.");
    } finally {
      setBusy(false);
    }
  }, [email, password, onUnlocked]);

  const requestReset = useCallback(async () => {
    if (!email.trim()) {
      setError("Entre ton email d'abord.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setForgotMessage(data.message ?? "Si ce compte existe, un lien de réinitialisation vient d'être envoyé.");
      setStep("forgot");
    } finally {
      setBusy(false);
    }
  }, [email]);

  return (
    <div className={desktop ? "flex min-h-dvh" : "flex min-h-0 flex-1 flex-col"}>
      <div
        className={
          desktop
            ? "flex w-[42%] max-w-[560px] flex-col items-center justify-center gap-6 border-r border-white/[.06] px-8 text-center"
            : "flex flex-col items-center gap-3.5 px-6 pt-10 pb-6 text-center"
        }
        style={{ background: "var(--color-ink)" }}
      >
        <Mark />
        <p className="text-20 font-extrabold tracking-tight text-white">Brief</p>
        {desktop && (
          <p className="max-w-[220px] text-13 font-medium leading-relaxed" style={{ color: "rgba(255,255,255,.6)" }}>
            Une tâche, un rendez-vous, une idée — jamais perdus.
          </p>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 safe-bottom">
        <div className="w-full max-w-[380px]">
          {step !== "forgot" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
                Connexion
              </p>
              <h1 className="mb-2 text-20 font-extrabold tracking-tight">Connecte-toi</h1>
              <p className="mb-6 text-13 font-medium text-ink-muted">
                Accès réservé aux comptes autorisés.
              </p>

              <label htmlFor="auth-email" className="mb-2 block text-13 font-semibold">
                Adresse email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 text-15 font-semibold text-ink outline-none focus:outline-2 focus:outline-ink"
              />

              <label htmlFor="auth-password" className="mt-4.5 mb-2 block text-13 font-semibold">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-13 w-full rounded-full border border-ink/[.08] bg-surface px-5 pr-13 text-15 font-semibold text-ink outline-none focus:outline-2 focus:outline-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>

              <p className="mt-3.5 min-h-[18px] text-13 font-semibold text-danger" role="alert">
                {error}
              </p>

              <button
                type="submit"
                disabled={busy}
                className="mt-5 h-13 w-full rounded-full text-15 font-bold text-white disabled:opacity-60"
                style={{ background: "var(--color-ink)" }}
              >
                Se connecter
              </button>

              <div className="mt-3.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void requestReset()}
                  className="text-13 font-semibold text-ink-muted"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          ) : (
            <div>
              <p className="mb-2.5 font-mono text-10 uppercase tracking-[.09em] text-ink-muted">
                Mot de passe oublié
              </p>
              <h1 className="mb-2 text-20 font-extrabold tracking-tight">Réinitialise ton mot de passe</h1>
              <p className="mb-6 text-13 font-medium leading-relaxed text-ink-muted">{forgotMessage}</p>
              <button
                type="button"
                onClick={() => setStep("login")}
                className="text-13 font-semibold text-ink underline"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

*(No `DEMO_NOTE` logic is used — it's left as a `null` constant only to make explicit in review that the shipped component has no hardcoded demo password, unlike the throwaway HTML mockup. Remove that line if it reads as clutter in review — it is not referenced anywhere.)*

Verify Tailwind arbitrary-value classes used here compile: `h-13` (52px, not a default Tailwind step) needs to exist or be replaced. **Check before finishing this task:**

```bash
grep -n -- "--spacing\|h-13\b" src/app/globals.css
```

If `13` (as a spacing step, i.e. 52px = 13 × 4px) is not a defined Tailwind v4 spacing scale value in this project, replace every `h-13`/`pr-13` with the arbitrary-value form `h-[52px]`/`pr-[52px]` instead — Tailwind v4's default spacing scale is a bare multiplier (`1` = 0.25rem = 4px), so `h-13` *should* resolve to 52px by default unless the project's `@theme` overrides the spacing scale. Confirm one way or the other and fix before moving to Task 12.

- [ ] **Step 2: Manual visual check (no automated test — this is a client component with no logic worth unit-testing beyond what Task 5/6/7's route tests already cover)**

Run `npm run dev` is disallowed if a dev server is already running (per `AGENTS.md`) — check first:

```bash
lsof -iTCP:3000 -sTCP:LISTEN 2>/dev/null
```

If nothing is listening, start one (`npm run dev`) and open `http://localhost:3000` in a browser to eyeball the gate. If port 3000 is taken, skip live verification here and rely on Task 12's integration + the browser check called out in that task instead.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthGate.tsx
git commit -m "feat: add AuthGate component"
```

---

### Task 12: Wire `AuthGate` into `BriefApp.tsx`

**Files:**
- Modify: `src/components/BriefApp.tsx`

**Interfaces:**
- Consumes: `AuthGate` (Task 11), `GET /api/auth/session` (Task 8), `POST /api/auth/logout` (Task 6).

- [ ] **Step 1: Swap the import**

```diff
-import { PinGate } from "./PinGate";
+import { AuthGate } from "./AuthGate";
```

- [ ] **Step 2: Replace the PIN-based bootstrap with an async session check**

Current (line 55, 75-78, 83): drop the `@/lib/pin` import entirely, drop the now-dead `pinHeader()` helper (defined at line 75-78, confirmed unused elsewhere by `grep -n "pinHeader()" src/components/BriefApp.tsx` returning only its own definition), and change the `unlocked` bootstrap from synchronous PIN presence to an async cookie-backed check — an httpOnly cookie can't be read from client JS, so this can no longer be known synchronously on first render:

```diff
-import { UnauthorizedError, clearPin, getPin, PIN_HEADER, readStoredTranscript } from "@/lib/pin";
+import { UnauthorizedError } from "@/lib/api";
```

(`UnauthorizedError` now comes from `@/lib/api`, per Task 10 — remove it from the existing `import { ApiError, ... } from "@/lib/api";` block if duplicated, or add it there.)

```diff
-/** Retourne les headers avec le PIN si disponible, pour les fetch directs. */
-function pinHeader(): Record<string, string> {
-  const pin = getPin();
-  return pin ? { [PIN_HEADER]: pin } : {};
-}
+/** Lecture d'un brouillon de transcription persistée (hors PIN — inutile de garder pin.ts pour ça). */
+function readStoredTranscript(): string {
+  if (typeof window === "undefined") return "";
+  try {
+    return window.localStorage.getItem("brief:transcript") ?? "";
+  } catch {
+    return "";
+  }
+}
```

```diff
 export function BriefApp() {
   const hydrated = useHydrated();
   const isDesktop = useIsDesktop();
-  const [unlocked, setUnlocked] = useState(() => !!getPin());
+  const [unlocked, setUnlocked] = useState<boolean | null>(null);
+
+  useEffect(() => {
+    let cancelled = false;
+    fetch("/api/auth/session")
+      .then((res) => {
+        if (!cancelled) setUnlocked(res.ok);
+      })
+      .catch(() => {
+        if (!cancelled) setUnlocked(false);
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, []);
```

- [ ] **Step 3: Update every `clearPin()` call site**

Every occurrence in this file is the pair `clearPin(); setUnlocked(false);` — there is no longer a client-side secret to clear (the session lives in an httpOnly cookie the server clears on logout), so just drop the `clearPin();` call and keep `setUnlocked(false);`. Confirmed exact occurrences by `grep -n "clearPin" src/components/BriefApp.tsx` before this edit — apply this same one-line removal at each:

```diff
-      if (e instanceof UnauthorizedError) { clearPin(); setUnlocked(false); }
+      if (e instanceof UnauthorizedError) { setUnlocked(false); }
```

(Repeat for every line matching this pattern — there were 5 at the time of writing this plan: two inline `clearPin(); setUnlocked(false);` pairs, one `onUnauthorized={() => { clearPin(); setUnlocked(false); }}` prop, and the two `if (e instanceof UnauthorizedError) { setUnlocked(false); }` bodies already had no `clearPin()`. Re-run the grep below to confirm all are gone.)

- [ ] **Step 4: Update the gate rendering — bypass `PhoneFrame` on desktop**

`PhoneFrame` (see `src/components/PhoneFrame.tsx`) bounds its content to a fixed 390×844px box at `sm:` breakpoint (≥640px) — a deliberate "phone mockup" look for the rest of the app's mobile screens, but wrong for `AuthGate`'s desktop split-screen layout. Every other top-level render branch in this file already checks `isDesktop` before choosing `DesktopShell` vs a `PhoneFrame`-wrapped mobile screen; the gate must follow the same pattern instead of always wrapping in `PhoneFrame`:

```diff
+  if (unlocked === null) {
+    return (
+      <PhoneFrame>
+        <StatusBar />
+        <div className="flex flex-1 items-center justify-center">
+          <span className="block size-6 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
+        </div>
+      </PhoneFrame>
+    );
+  }
+
   if (!unlocked) {
+    if (isDesktop) {
+      return <AuthGate desktop onUnlocked={() => setUnlocked(true)} />;
+    }
     return (
       <PhoneFrame>
         <StatusBar />
-        <PinGate onUnlocked={() => setUnlocked(true)} />
+        <AuthGate onUnlocked={() => setUnlocked(true)} />
       </PhoneFrame>
     );
   }
```

(The existing `!hydrated` branch above this one, which shows the same spinner inside `PhoneFrame`, stays untouched — it now runs before the new `unlocked === null` branch, both rendering the same loading UI for different reasons, which is fine.)

- [ ] **Step 5: Logout — find the "Verrouiller" action and make it call the server**

```bash
grep -n "Verrouiller\|onUnauthorized" src/components/BriefApp.tsx src/components/desktop/*.tsx src/components/AccountSheet.tsx 2>/dev/null
```

Wherever the "Verrouiller" button currently calls `clearPin(); setUnlocked(false);` (client-only), change it to also tell the server to end the session, since there is no longer a client-clearable secret — the source of truth is the httpOnly cookie:

```diff
-onClick={() => { clearPin(); setUnlocked(false); }}
+onClick={() => {
+  void fetch("/api/auth/logout", { method: "POST" });
+  setUnlocked(false);
+}}
```

- [ ] **Step 6: Verify**

```bash
grep -n "clearPin\|getPin\|PIN_HEADER\|from \"@/lib/pin\"" src/components/BriefApp.tsx
```

Expected: no output.

```bash
npx tsc --noEmit
```

Expected: clean, or only errors pointing at the four other files migrated in Task 13.

- [ ] **Step 7: Manual browser check**

```bash
lsof -iTCP:3000 -sTCP:LISTEN 2>/dev/null || npm run dev
```

Open `http://localhost:3000`. Expect the `AuthGate` to render (login will fail without real Supabase env vars configured locally yet — that's expected at this point in the plan; just confirm the screen renders without a client crash, at both a desktop-width and a narrow browser window).

- [ ] **Step 8: Commit**

```bash
git add src/components/BriefApp.tsx
git commit -m "feat: wire AuthGate into BriefApp, drop client-side PIN state"
```

---

### Task 13: Update remaining `pin.ts` importers, delete `pin.ts`

**Files:**
- Modify: `src/components/TaskDetailScreen.tsx`, `src/components/AgendaScreen.tsx`, `src/components/desktop/DesktopCalendar.tsx`, `src/components/desktop/DesktopTaskDetail.tsx`
- Delete: `src/lib/pin.ts`, `src/lib/pin.test.ts`

- [ ] **Step 1: Repoint the four remaining importers**

```bash
sed -i '' 's/import { apiFetch } from "@\/lib\/pin";/import { apiFetch } from "@\/lib\/api";/' \
  src/components/TaskDetailScreen.tsx src/components/desktop/DesktopTaskDetail.tsx

sed -i '' 's/import { UnauthorizedError } from "@\/lib\/pin";/import { UnauthorizedError } from "@\/lib\/api";/' \
  src/components/AgendaScreen.tsx src/components/desktop/DesktopCalendar.tsx
```

- [ ] **Step 2: Delete `pin.ts` and its test**

```bash
rm src/lib/pin.ts src/lib/pin.test.ts
```

- [ ] **Step 3: Verify nothing else references it**

```bash
grep -rln "@/lib/pin\|from \"./pin\"" src
```

Expected: no output.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: all three clean.

- [ ] **Step 5: Commit**

```bash
git add -A src/components src/lib
git commit -m "feat: remove pin.ts, all callers use api.ts"
```

---

### Task 14: Docs — `AGENTS.md` invariant, `DECISIONS.md` entry

**Files:**
- Modify: `AGENTS.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Update the security invariant in `AGENTS.md`**

Replace lines 75-84 (`### Sécurité` through the `guard.ts` sentence):

```diff
 ### Sécurité

-**Toute route sous `/api/` commence par la garde PIN.** Sans exception :
+**Toute route sous `/api/` commence par la garde de session.** Sans exception :

 ```ts
-const denied = requirePin(req);
+const denied = await requireSession();
 if (denied) return denied;
 ```

-L'URL de déploiement est publique ; `src/lib/guard.ts` est la seule barrière.
-L'écran PIN et la mémorisation locale (localStorage) ne sont que de l'UX, ils ne
-protègent rien — depuis le 2026-08-17, le code est saisi une fois par appareil
-puis mémorisé (`DECISIONS.md`).
+L'URL de déploiement est publique ; `src/lib/guard.ts` est la seule barrière.
+Authentification par email + mot de passe (Supabase Auth) depuis le 2026-08-26
+— voir `docs/superpowers/specs/2026-08-26-email-password-auth-design.md` et
+`DECISIONS.md`. Le PIN partagé unique (`BRIEF_PIN`) est retiré.
```

- [ ] **Step 2: Add the `DECISIONS.md` entry**

Insert at the top of the file, right after the header block (before the first `---`):

```markdown
## 2026-08-26 · Le PIN partagé devient une auth email + mot de passe (Supabase)

**Décision.** Le PIN unique (`BRIEF_PIN`, `src/lib/guard.ts`) est remplacé par
une identité par utilisateur : email + mot de passe, via Supabase Auth. Une
table Postgres `authorized_users` sert de liste blanche (aucune inscription
libre — les comptes sont créés à la main par Aramis). Les routes machine
(cron, capture, digest) gardent leurs jetons dédiés, inchangés.

**Pourquoi.** Deux raisons d'Aramis (26/08) : sécurité (le PIN est un secret
en clair côté client, sans notion d'identité) et préparation au
multi-utilisateur (un second utilisateur viendra). Design complet et maquette
validée avant implémentation — voir
`docs/superpowers/specs/2026-08-26-email-password-auth-design.md` et
`https://claude.ai/code/artifact/5655973d-ef06-4ed1-8585-90c6af776456`.

**Comment.** `requireSession()` (nouveau, remplace `requirePin()`) vérifie
localement un JWT Supabase (pas d'appel réseau par requête) ; `src/proxy.ts`
(Next 16 a renommé `middleware.ts` en `proxy.ts`) rafraîchit la session sur
chaque requête. `POST /api/auth/login|logout|forgot-password`,
`GET /api/auth/session`. `src/lib/pin.ts` supprimé.

**Statut.** 🔶 en cours d'implémentation (`docs/superpowers/plans/2026-08-26-email-password-auth.md`).

---

```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md DECISIONS.md
git commit -m "docs: update security invariant and decisions log for email+password auth"
```

---

## Self-Review

**Spec coverage:**
- Architecture (Supabase Auth + `authorized_users` + `requireSession`) → Tasks 1-3, 5.
- All 18 routes migrated → Tasks 4, 8 (session route replaced, not migrated).
- `AuthGate.tsx` replacing `PinGate.tsx`, maquette respected → Task 11-12.
- `pin.ts` deleted, `apiFetch()` simplified → Tasks 10, 13.
- Migration (env vars, manual Supabase steps, doc updates) → Tasks 1 (env), 2 (manual steps flagged), 14 (docs).
- Tests → every task with app code has a task-local Vitest file; the one genuinely external step (applying the SQL against a real Supabase project) is explicitly flagged as manual, per the spec's own Migration section.
- Anti-enumeration (generic errors) → Task 5 (login), Task 7 (forgot-password), tested explicitly in both.

**Resolved tension not fully spelled out in the spec:** the spec's Data flow section (step 4) says `requireSession()` does *only* local JWT verification, no DB call — but its own defense-in-depth reasoning for `authorized_users` implied a per-request check. This plan resolves it explicitly (Task 5's login route is the only place that queries `authorized_users`; `requireSession()` never does): since Brief has no public sign-up route, `auth.users` itself is already the allow-list, and `authorized_users` gates *entry* (login) rather than being re-checked on every subsequent request. This keeps `requireSession()` network-free as the spec intended, and is noted inline in Task 3.

**Type consistency:** `getSupabaseServerClient()` (Task 1) is the single factory used by Task 3, 5, 6, 7. `requireSession()` (Task 3) has one signature (`(): Promise<Response | null>`) used identically by Task 4's 17 routes and Task 8. `AuthGate`'s prop shape (`{ onUnlocked: () => void; desktop?: boolean }`, Task 11) matches exactly how Task 12 calls it in both branches.

**Placeholder scan:** no TBD/TODO; the one intentionally-manual step (Task 2, Step 6) is explicit about being manual and unactionable by the coding agent, not a vague deferral.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-26-email-password-auth.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
