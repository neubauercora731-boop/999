begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    display_name = coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    avatar_url = new.raw_user_meta_data ->> 'avatar_url',
    updated_at = timezone('utc', now())
  where id = new.id;

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  student_number text,
  major text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'awaiting_analysis',
      'awaiting_confirmation',
      'generating_outline',
      'generating_report',
      'completed',
      'failed',
      'archived'
    )
  ),
  experiment_name text,
  course_name text,
  description text,
  analysis_summary jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create table public.task_inputs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  task_book_text text,
  requirement_text text,
  student_notes text,
  template_instructions text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (task_id),
  constraint task_inputs_task_owner_fkey foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  file_type text not null check (file_type in ('task_book', 'screenshot', 'data', 'code', 'template', 'other')),
  storage_bucket text not null default 'task-files',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_files_task_owner_fkey foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_files_task_id_idx on public.task_files (task_id);
create index task_files_user_id_idx on public.task_files (user_id);

create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  run_type text not null check (run_type in ('analyze', 'generate_outline', 'generate_report', 'consistency_check')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  model text not null default 'kimi-k2.5',
  input_context jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_runs_task_owner_fkey foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_runs_task_id_idx on public.task_runs (task_id);
create index task_runs_user_id_idx on public.task_runs (user_id);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_run_id uuid not null references public.task_runs (id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null,
  step_key text not null,
  step_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_steps_task_owner_fkey foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_steps_task_run_id_idx on public.task_steps (task_run_id);
create index task_steps_task_id_idx on public.task_steps (task_id);

create table public.task_outputs (
  id uuid primary key default gen_random_uuid(),
  task_run_id uuid not null unique references public.task_runs (id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null,
  parsed_requirement_json jsonb not null default '{}'::jsonb,
  missing_fields_json jsonb not null default '[]'::jsonb,
  outline_json jsonb not null default '{}'::jsonb,
  report_json jsonb not null default '{}'::jsonb,
  consistency_json jsonb not null default '{}'::jsonb,
  outline_markdown text,
  report_markdown text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_outputs_task_owner_fkey foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_outputs_task_id_idx on public.task_outputs (task_id);

create table public.billing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  task_run_id uuid references public.task_runs (id) on delete set null,
  provider text not null default 'moonshot',
  event_type text not null,
  amount_cents integer not null default 0,
  currency text not null default 'CNY',
  status text not null default 'recorded' check (status in ('recorded', 'pending', 'paid', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index billing_logs_user_id_idx on public.billing_logs (user_id);
create index billing_logs_task_id_idx on public.billing_logs (task_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_inputs enable row level security;
alter table public.task_files enable row level security;
alter table public.task_runs enable row level security;
alter table public.task_steps enable row level security;
alter table public.task_outputs enable row level security;
alter table public.billing_logs enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (id = auth.uid());

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using (user_id = auth.uid());

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check (user_id = auth.uid());

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using (user_id = auth.uid());

create policy "task_inputs_select_own"
on public.task_inputs
for select
to authenticated
using (user_id = auth.uid());

create policy "task_inputs_insert_own"
on public.task_inputs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_inputs_update_own"
on public.task_inputs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_inputs_delete_own"
on public.task_inputs
for delete
to authenticated
using (user_id = auth.uid());

create policy "task_files_select_own"
on public.task_files
for select
to authenticated
using (user_id = auth.uid());

create policy "task_files_insert_own"
on public.task_files
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_files_update_own"
on public.task_files
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_files_delete_own"
on public.task_files
for delete
to authenticated
using (user_id = auth.uid());

create policy "task_runs_select_own"
on public.task_runs
for select
to authenticated
using (user_id = auth.uid());

create policy "task_runs_insert_own"
on public.task_runs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_runs_update_own"
on public.task_runs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_runs_delete_own"
on public.task_runs
for delete
to authenticated
using (user_id = auth.uid());

create policy "task_steps_select_own"
on public.task_steps
for select
to authenticated
using (user_id = auth.uid());

create policy "task_steps_insert_own"
on public.task_steps
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_steps_update_own"
on public.task_steps
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_steps_delete_own"
on public.task_steps
for delete
to authenticated
using (user_id = auth.uid());

create policy "task_outputs_select_own"
on public.task_outputs
for select
to authenticated
using (user_id = auth.uid());

create policy "task_outputs_insert_own"
on public.task_outputs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_outputs_update_own"
on public.task_outputs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_outputs_delete_own"
on public.task_outputs
for delete
to authenticated
using (user_id = auth.uid());

create policy "billing_logs_select_own"
on public.billing_logs
for select
to authenticated
using (user_id = auth.uid());

create policy "billing_logs_insert_own"
on public.billing_logs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "billing_logs_update_own"
on public.billing_logs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "billing_logs_delete_own"
on public.billing_logs
for delete
to authenticated
using (user_id = auth.uid());

create trigger handle_new_user_after_insert
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger sync_profile_after_update
after update on auth.users
for each row execute function public.sync_user_profile();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_task_inputs_updated_at
before update on public.task_inputs
for each row execute function public.set_updated_at();

create trigger set_task_files_updated_at
before update on public.task_files
for each row execute function public.set_updated_at();

create trigger set_task_runs_updated_at
before update on public.task_runs
for each row execute function public.set_updated_at();

create trigger set_task_steps_updated_at
before update on public.task_steps
for each row execute function public.set_updated_at();

create trigger set_task_outputs_updated_at
before update on public.task_outputs
for each row execute function public.set_updated_at();

create trigger set_billing_logs_updated_at
before update on public.billing_logs
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'task-files',
  'task-files',
  false,
  52428800
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

alter table storage.objects enable row level security;

create policy "task_files_objects_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "task_files_objects_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "task_files_objects_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-files'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'task-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "task_files_objects_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-files'
  and split_part(name, '/', 1) = auth.uid()::text
);

grant usage on schema public to authenticated, service_role;
grant usage on schema storage to authenticated, service_role;

grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.tasks to authenticated, service_role;
grant select, insert, update, delete on public.task_inputs to authenticated, service_role;
grant select, insert, update, delete on public.task_files to authenticated, service_role;
grant select, insert, update, delete on public.task_runs to authenticated, service_role;
grant select, insert, update, delete on public.task_steps to authenticated, service_role;
grant select, insert, update, delete on public.task_outputs to authenticated, service_role;
grant select, insert, update, delete on public.billing_logs to authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;

commit;
