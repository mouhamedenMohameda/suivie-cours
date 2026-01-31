create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  full_name text not null,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists time_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes int not null,
  subject text not null,
  created_at timestamptz default now()
);

create table if not exists schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  time_slot_id uuid not null references time_slots on delete cascade,
  student_id uuid not null references students on delete cascade,
  created_at timestamptz default now(),
  unique (time_slot_id, student_id)
);

create table if not exists progress_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject text not null,
  notes text,
  progress_level smallint,
  record_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists lesson_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  student_id uuid references students on delete set null,
  subject text not null,
  instructions text,
  status text not null default 'requested' check (status in ('draft', 'requested', 'completed', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists lesson_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  lesson_request_id uuid not null references lesson_requests on delete cascade,
  content text not null,
  model text,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table if not exists student_ai_chats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  created_at timestamptz default now(),
  unique (student_id)
);

create table if not exists student_ai_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  chat_id uuid not null references student_ai_chats on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  body text,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table students enable row level security;
alter table time_slots enable row level security;
alter table schedule_assignments enable row level security;
alter table progress_records enable row level security;
alter table lesson_requests enable row level security;
alter table lesson_proposals enable row level security;
alter table notifications enable row level security;
alter table student_ai_chats enable row level security;
alter table student_ai_messages enable row level security;

create policy "Profiles are private"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Students are private"
  on students for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Time slots are private"
  on time_slots for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Schedule assignments are private"
  on schedule_assignments for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Progress records are private"
  on progress_records for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Lesson requests are private"
  on lesson_requests for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Lesson proposals are private"
  on lesson_proposals for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Notifications are private"
  on notifications for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Student AI chats are private"
  on student_ai_chats for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Student AI messages are private"
  on student_ai_messages for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
