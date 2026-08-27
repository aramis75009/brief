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

  it("grants both select and update to the authenticated role", () => {
    // Task 5's login route does .select(...).maybeSingle() AND
    // .update({ last_login_at }) on this table — a select-only policy would
    // make the update silently affect zero rows under RLS.
    expect(SQL).toMatch(/for select/);
    expect(SQL).toMatch(/for update/);
  });
});
