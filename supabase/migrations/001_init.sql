-- Recipe Book schema.
-- Anyone (anon) can read recipes; only signed-in users (just you — sign-ups are disabled)
-- can add/edit/delete. The Mac worker uses the service-role key, which bypasses RLS.

create extension if not exists pgcrypto;

-- ── Recipes ────────────────────────────────────────────────────────────────
create table public.recipes (
  id                  text primary key,              -- "<source_type>-<source_id>"
  source_type         text not null check (source_type in ('tiktok', 'instagram', 'web')),
  source_id           text not null,
  source_url          text not null,
  source_name         text,                          -- "@creator" or site name
  author              text,
  title               text not null,
  thumbnail_path      text,                          -- path inside the "thumbs" storage bucket
  cuisine             text not null default 'Other',
  tags                text[] not null default '{}',
  base_servings       int not null default 2,
  servings_estimated  boolean not null default false,
  measurements_source text not null default 'explicit'
                      check (measurements_source in ('explicit', 'mixed', 'estimated')),
  prep_minutes        int,
  cook_minutes        int,
  total_minutes       int,
  time_estimated      boolean not null default false,
  ingredients         jsonb not null default '[]',   -- [{group, quantity, unit, item, note, scalable, estimated}]
  steps               jsonb not null default '[]',   -- [{text, timer_minutes}]
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (source_type, source_id)
);
create index recipes_cuisine_idx on public.recipes (cuisine);
create index recipes_created_idx on public.recipes (created_at desc);

-- Raw text the recipe was built from. Private: only you can read it.
create table public.recipe_sources (
  recipe_id   text primary key references public.recipes(id) on delete cascade,
  source_text text,       -- caption / page text / structured recipe data
  transcript  text,       -- Whisper transcript of the narration
  updated_at  timestamptz not null default now()
);

-- ── Jobs (the queue the Mac worker drains) ─────────────────────────────────
create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'import' check (kind in ('import', 'reextract')),
  url         text not null,
  source_type text not null check (source_type in ('tiktok', 'instagram', 'web')),
  status      text not null default 'queued'
              check (status in ('queued', 'processing', 'done', 'failed', 'not_recipe')),
  error       text,
  manual_text text,       -- pasted caption/recipe text when fetching fails
  recipe_id   text references public.recipes(id) on delete set null,
  attempts    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index jobs_status_idx on public.jobs (status, created_at);

-- ── updated_at triggers ────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
create trigger recipe_sources_touch before update on public.recipe_sources
  for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ── Row-level security ─────────────────────────────────────────────────────
alter table public.recipes        enable row level security;
alter table public.recipe_sources enable row level security;
alter table public.jobs           enable row level security;

create policy "recipes readable by everyone" on public.recipes
  for select to anon, authenticated using (true);
create policy "recipes editable by owner" on public.recipes
  for update to authenticated using (true) with check (true);
create policy "recipes deletable by owner" on public.recipes
  for delete to authenticated using (true);

create policy "sources readable by owner" on public.recipe_sources
  for select to authenticated using (true);

create policy "jobs readable by owner" on public.jobs
  for select to authenticated using (true);
create policy "jobs insertable by owner" on public.jobs
  for insert to authenticated with check (true);
create policy "jobs updatable by owner" on public.jobs
  for update to authenticated using (true) with check (true);
create policy "jobs deletable by owner" on public.jobs
  for delete to authenticated using (true);

-- Live job status in the Add tab.
alter publication supabase_realtime add table public.jobs;

-- ── Storage: public thumbnails ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('thumbs', 'thumbs', true)
on conflict (id) do nothing;

create policy "owner deletes thumbs" on storage.objects
  for delete to authenticated using (bucket_id = 'thumbs');
