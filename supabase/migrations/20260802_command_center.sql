create table if not exists public.myt_command_center_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  properties jsonb not null default '[]'::jsonb,
  rooms jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.myt_command_center_states enable row level security;

create policy "Users can read their command center state"
  on public.myt_command_center_states for select
  using (auth.uid() = user_id);

create policy "Users can create their command center state"
  on public.myt_command_center_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update their command center state"
  on public.myt_command_center_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
