begin;

alter table public.tasks
  add column if not exists current_step text,
  add column if not exists parsed_requirement_json jsonb,
  add column if not exists outline_json jsonb,
  add column if not exists report_markdown text,
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists generation_status text not null default 'pending',
  add column if not exists consistency_status text not null default 'pending',
  add column if not exists last_error text;

update public.tasks
set status = case
  when status = 'awaiting_analysis' then 'uploaded'
  when status = 'awaiting_confirmation' then 'waiting_confirm'
  else status
end;

update public.tasks
set
  parsed_requirement_json = coalesce(
    parsed_requirement_json,
    nullif(analysis_summary, '{}'::jsonb)
  ),
  current_step = coalesce(
    current_step,
    case
      when status = 'completed' then 'consistency_ready'
      when status = 'checking' then 'checking'
      when report_markdown is not null then 'report_ready'
      when outline_json is not null then 'outline_ready'
      when parsed_requirement_json is not null or nullif(analysis_summary, '{}'::jsonb) is not null then 'analysis_ready'
      else 'uploaded'
    end
  ),
  analysis_status = case
    when parsed_requirement_json is not null or nullif(analysis_summary, '{}'::jsonb) is not null then 'success'
    when status = 'analyzing' then 'running'
    when status = 'failed' then 'error'
    else coalesce(nullif(analysis_status, ''), 'pending')
  end,
  generation_status = case
    when report_markdown is not null or outline_json is not null then 'success'
    when status in ('generating_outline', 'generating_report') then 'running'
    when status = 'failed' then 'error'
    else coalesce(nullif(generation_status, ''), 'pending')
  end,
  consistency_status = case
    when status = 'checking' then 'running'
    when status = 'completed' then 'success'
    when status = 'failed' then 'error'
    else coalesce(nullif(consistency_status, ''), 'pending')
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_status_check
      check (
        status in (
          'draft',
          'uploaded',
          'analyzing',
          'waiting_confirm',
          'generating_outline',
          'generating_report',
          'checking',
          'completed',
          'failed'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_analysis_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_analysis_status_check
      check (analysis_status in ('pending', 'running', 'success', 'error'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_generation_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_generation_status_check
      check (generation_status in ('pending', 'running', 'success', 'error'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_consistency_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_consistency_status_check
      check (consistency_status in ('pending', 'running', 'success', 'error'));
  end if;
end $$;

create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_current_step_idx on public.tasks (current_step);

alter table public.task_runs
  add column if not exists run_no integer,
  add column if not exists model_name text;

with numbered_runs as (
  select
    id,
    row_number() over (
      partition by task_id
      order by created_at asc, id asc
    ) as next_run_no
  from public.task_runs
)
update public.task_runs runs
set run_no = numbered_runs.next_run_no
from numbered_runs
where runs.id = numbered_runs.id
  and runs.run_no is null;

update public.task_runs
set model_name = coalesce(model_name, model, 'kimi-k2.5')
where model_name is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'task_runs_status_check'
      and conrelid = 'public.task_runs'::regclass
  ) then
    alter table public.task_runs drop constraint task_runs_status_check;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_runs_status_check'
      and conrelid = 'public.task_runs'::regclass
  ) then
    alter table public.task_runs
      add constraint task_runs_status_check
      check (
        status in (
          'queued',
          'running',
          'success',
          'error',
          'canceled',
          'succeeded',
          'failed'
        )
      );
  end if;
end $$;

create index if not exists task_runs_task_id_run_no_idx
  on public.task_runs (task_id, run_no desc);

alter table public.task_steps
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

update public.task_steps
set started_at = coalesce(started_at, created_at)
where started_at is null;

update public.task_steps
set finished_at = coalesce(finished_at, created_at)
where finished_at is null
  and status in ('success', 'error', 'skipped', 'succeeded', 'failed');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'task_steps_status_check'
      and conrelid = 'public.task_steps'::regclass
  ) then
    alter table public.task_steps drop constraint task_steps_status_check;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_steps_status_check'
      and conrelid = 'public.task_steps'::regclass
  ) then
    alter table public.task_steps
      add constraint task_steps_status_check
      check (
        status in (
          'pending',
          'running',
          'success',
          'error',
          'skipped',
          'succeeded',
          'failed'
        )
      );
  end if;
end $$;

create index if not exists task_steps_task_run_id_step_order_idx
  on public.task_steps (task_run_id, step_order);

commit;
