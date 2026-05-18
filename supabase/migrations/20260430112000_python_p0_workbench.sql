begin;

alter table public.task_files
  add column if not exists parsed_text text;

create table if not exists public.task_analysis (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  analysis_json jsonb not null default '{}'::jsonb,
  confirmed_by_user boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (task_id),
  constraint task_analysis_task_owner_fkey
    foreign key (task_id, user_id)
    references public.tasks (id, user_id)
    on delete cascade
);

alter table public.task_outputs
  add column if not exists docx_url text;

update public.task_files
set parsed_text = coalesce(parsed_text, metadata ->> 'text_excerpt')
where parsed_text is null;

update public.tasks
set status = case
  when status in ('waiting_confirm', 'awaiting_confirmation') then 'analyzed'
  when status in ('completed') then 'generated'
  when status in ('generating_outline', 'generating_report', 'checking') then 'confirmed'
  when status = 'awaiting_analysis' then 'uploaded'
  else status
end;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tasks_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_status_check;
  end if;
end $$;

alter table public.tasks
  add constraint tasks_status_check
  check (
    status in (
      'draft',
      'uploaded',
      'analyzing',
      'analyzed',
      'confirmed',
      'generated',
      'exported',
      'failed'
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'task_runs_run_type_check'
      and conrelid = 'public.task_runs'::regclass
  ) then
    alter table public.task_runs drop constraint task_runs_run_type_check;
  end if;
end $$;

alter table public.task_runs
  add constraint task_runs_run_type_check
  check (
    run_type in (
      'analyze',
      'confirm_analysis',
      'generate_code',
      'run_code',
      'generate_report',
      'save_report',
      'export_docx',
      'consistency_check',
      'generate_outline'
    )
  );

alter table public.task_analysis enable row level security;

drop policy if exists "task_analysis_select_own" on public.task_analysis;
drop policy if exists "task_analysis_insert_own" on public.task_analysis;
drop policy if exists "task_analysis_update_own" on public.task_analysis;
drop policy if exists "task_analysis_delete_own" on public.task_analysis;

create policy "task_analysis_select_own"
on public.task_analysis
for select
to authenticated
using (user_id = auth.uid());

create policy "task_analysis_insert_own"
on public.task_analysis
for insert
to authenticated
with check (user_id = auth.uid());

create policy "task_analysis_update_own"
on public.task_analysis
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "task_analysis_delete_own"
on public.task_analysis
for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_task_analysis_updated_at on public.task_analysis;

create trigger set_task_analysis_updated_at
before update on public.task_analysis
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.task_analysis to authenticated, service_role;

commit;
