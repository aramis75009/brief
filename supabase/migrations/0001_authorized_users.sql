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

-- POST /api/auth/login (Task 5) met à jour last_login_at après connexion —
-- sans cette policy, l'update est silencieusement bloqué par RLS (0 ligne
-- affectée, aucune erreur renvoyée par PostgREST).
create policy "update own row"
  on public.authorized_users
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
