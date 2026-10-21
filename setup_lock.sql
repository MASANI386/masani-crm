-- =====================================================================
-- STEP 2 (LOCK) — Ye TAB chalana jab app me login kaam kar jaye.
-- Isse purane tables (customers, policies, vehicles...) bhi sirf login walon ke liye ho jaate hain.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['customers','policies','vehicles','commission_rules','audit_logs'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "login only" on public.%I', t);
      execute format('create policy "login only" on public.%I for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;
