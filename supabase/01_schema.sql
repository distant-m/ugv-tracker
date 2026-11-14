-- =====================================================================
-- 01_schema.sql — структура бази, ролі, правила доступу, журнал змін.
-- Запускати один раз у Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- ---------- Ролі користувачів ----------
do $$ begin create type public.app_role as enum ('admin','user','viewer'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  role public.app_role not null default 'viewer',
  tracks text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Новий користувач (запрошений) автоматично отримує профіль з роллю «глядач».
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Допоміжні функції для правил доступу
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;
create or replace function public.can_edit_track(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'user' and t = any(p.tracks))
$$;

-- ---------- Дані проєкту ----------
create table if not exists public.settings(
  key text primary key,
  value jsonb not null
);

create table if not exists public.tracks(
  id text primary key,
  tag text not null,
  name_uk text not null,
  name_en text not null,
  sub_uk text,
  sub_en text,
  kind text not null,               -- stages | training | event | proc
  target integer,                    -- план навчених (для підсумків)
  target_label text,                 -- текст плану, напр. «3 700–4 100»
  sort integer not null default 0
);

create table if not exists public.stages(
  id text primary key,
  idx integer not null,
  name_uk text not null,
  name_en text not null,
  month_from integer not null,
  month_to integer not null
);

create table if not exists public.groups(
  id text primary key,
  track_id text not null references public.tracks(id),
  type text not null,                -- course | mobile | intro | event | lecture | press
  title_uk text not null,
  title_en text not null,
  short text,
  start_date date not null,
  end_date date not null,
  plan integer,
  facts jsonb not null default '{}',
  docs jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.procurement(
  id text primary key,
  name_uk text not null,
  name_en text not null,
  qty integer,
  due_month integer not null,
  status text not null default 'planned' check (status in ('planned','ordered','paid','received')),
  link text not null default '',
  sort integer not null default 0
);

create table if not exists public.indicators(
  id text primary key,
  level text not null,               -- ult | int | imm | out
  sort integer not null,
  label_uk text not null,
  label_en text not null,
  baseline text,
  target text,
  target_num numeric,
  freq text not null,                -- quarterly | semi
  source text not null,              -- manual | auto:<метрика>
  value numeric,
  value2 numeric,
  link text not null default ''
);
alter table public.indicators add column if not exists fm jsonb not null default '{}'::jsonb;  -- survey_fm: {sf,af,sm,am}

create table if not exists public.admin_tasks(
  id text primary key,
  section text not null,             -- launch | cycle | period | close | custom
  title_uk text not null,
  title_en text not null,
  due_month integer,
  freq text,
  done boolean not null default false,
  link text not null default '',
  sort integer not null default 0
);

create table if not exists public.positions(
  id text primary key,
  parent text references public.positions(id),
  report_to text references public.positions(id),
  side boolean not null default false,
  level integer not null,
  name_uk text not null,
  name_en text not null,
  multi boolean not null default false,
  slot_uk text,
  slot_en text,
  template text,                     -- файл шаблону обов'язків у сховищі
  sort integer not null default 0
);

create table if not exists public.staff_slots(
  id uuid primary key default gen_random_uuid(),
  position_id text not null references public.positions(id) on delete cascade,
  idx integer not null default 0,
  nick text not null default '',
  nda boolean not null default false, nda_link text not null default '',
  sec boolean not null default false, sec_link text not null default '',
  resp boolean not null default false, resp_link text not null default '',
  off boolean not null default false,
  note text not null default ''
);

-- ---------- Журнал змін ----------
create table if not exists public.audit_log(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  tbl text not null,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb
);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  rid text := coalesce(n->>'id', o->>'id', n->>'key', o->>'key');
begin
  if tg_op = 'UPDATE' and o = n then return new; end if;
  insert into public.audit_log(actor, actor_email, tbl, row_id, action, old_data, new_data)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()),
          tg_table_name, rid, lower(tg_op), o, n);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','settings','tracks','stages','groups','procurement','indicators','admin_tasks','positions','staff_slots'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- Користувач (не адміністратор) може змінювати в групі лише факти й посилання на документи.
create or replace function public.groups_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and
     (new.id, new.track_id, new.type, new.title_uk, new.title_en, new.short, new.start_date, new.end_date, new.plan)
     is distinct from
     (old.id, old.track_id, old.type, old.title_uk, old.title_en, old.short, old.start_date, old.end_date, old.plan) then
    raise exception 'Змінювати структуру групи може лише адміністратор';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists groups_guard on public.groups;
create trigger groups_guard before update on public.groups for each row execute function public.groups_guard();

-- Користувач не може змінити собі роль чи треки.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (new.role, new.tracks, new.active, new.email) is distinct from (old.role, old.tracks, old.active, old.email) then
    raise exception 'Змінювати роль і доступ може лише адміністратор';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- ---------- Правила доступу (RLS) ----------
alter table public.profiles    enable row level security;
alter table public.settings    enable row level security;
alter table public.tracks      enable row level security;
alter table public.stages      enable row level security;
alter table public.groups      enable row level security;
alter table public.procurement enable row level security;
alter table public.indicators  enable row level security;
alter table public.admin_tasks enable row level security;
alter table public.positions   enable row level security;
alter table public.staff_slots enable row level security;
alter table public.audit_log   enable row level security;

-- Профілі: кожен бачить себе; адміністратор — усіх.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- Загальні дані: читають усі учасники; змінює адміністратор.
do $$ declare t text; begin
  foreach t in array array['settings','tracks','stages','procurement','indicators'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('drop policy if exists %1$s_write on public.%1$I', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Групи: читають усі учасники; адміністратор — усе; користувач — лише групи своїх треків.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated using (public.is_member());
drop policy if exists groups_admin on public.groups;
create policy groups_admin on public.groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists groups_user_update on public.groups;
create policy groups_user_update on public.groups for update to authenticated using (public.can_edit_track(track_id)) with check (public.can_edit_track(track_id));

-- Задачі адміністратора, персонал, журнал: лише адміністратор.
do $$ declare t text; begin
  foreach t in array array['admin_tasks','positions','staff_slots'] loop
    execute format('drop policy if exists %1$s_admin on public.%1$I', t);
    execute format('create policy %1$s_admin on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- Права ролей API ----------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.settings, public.tracks, public.stages, public.groups,
  public.procurement, public.indicators, public.admin_tasks, public.positions, public.staff_slots to authenticated;
grant select, update, delete on public.profiles to authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
grant execute on function public.my_role(), public.is_member(), public.is_admin(), public.can_edit_track(text) to authenticated;

-- ---------- Сховище шаблонів посадових обов'язків (закрите) ----------
insert into storage.buckets(id, name, public) values ('templates', 'templates', false) on conflict (id) do nothing;
drop policy if exists templates_read on storage.objects;
create policy templates_read on storage.objects for select to authenticated using (bucket_id = 'templates' and public.is_member());
drop policy if exists templates_write on storage.objects;
create policy templates_write on storage.objects for all to authenticated using (bucket_id = 'templates' and public.is_admin()) with check (bucket_id = 'templates' and public.is_admin());

-- ---------- Зсув графіка, коли відома дата старту ----------
-- Приклад: select public.set_project_start('2027-01-01');
create or replace function public.set_project_start(p_start date) returns void
language plpgsql security definer set search_path = public as $$
declare old_start date;
begin
  if not public.is_admin() and auth.uid() is not null then raise exception 'Лише адміністратор'; end if;
  select (value #>> '{}')::date into old_start from public.settings where key = 'start_date';
  if old_start is null then raise exception 'Немає дати старту в settings'; end if;
  update public.groups set start_date = start_date + (p_start - old_start), end_date = end_date + (p_start - old_start);
  update public.settings set value = to_jsonb(p_start::text) where key = 'start_date';
end $$;
revoke all on function public.set_project_start(date) from public, anon;
grant execute on function public.set_project_start(date) to authenticated;
