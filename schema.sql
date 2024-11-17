-- Reset schema (if needed)
drop schema public cascade;
create schema public;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable the pgcrypto extension (if not already enabled)
create extension if not exists pgcrypto;

-- Set up permissions for the public schema
grant usage on schema public to postgres, anon, authenticated;

-- Create a table for user profiles
create table profiles (
  id uuid references auth.users on delete cascade not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id),
  unique(email)
);

-- Create a table for todos
create table todos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  completed boolean default false,
  due_date timestamp with time zone,
  shared_with uuid[] default array[]::uuid[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for notifications
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  type text not null,
  content text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Grant access to tables
grant all on all tables in schema public to postgres, anon, authenticated;
grant all on all sequences in schema public to postgres, anon, authenticated;
grant all on all functions in schema public to postgres, anon, authenticated;

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;
alter table todos enable row level security;
alter table notifications enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Create policies for todos
create policy "Users can view own todos and shared todos" 
  on todos for select
  using (
    auth.uid() = user_id or
    auth.uid() = any (shared_with)
  );

create policy "Users can insert own todos" 
  on todos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own todos" 
  on todos for update
  using (auth.uid() = user_id);

create policy "Users can delete own todos" 
  on todos for delete
  using (auth.uid() = user_id);

-- Create policies for notifications
create policy "Users can view own notifications" 
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications" 
  on notifications for update
  using (auth.uid() = user_id);

create policy "Anyone can insert notifications" 
  on notifications for insert
  with check (true);

-- Set up automatic privileges for future tables
alter default privileges in schema public grant all on tables to postgres, anon, authenticated;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated;

-- Create function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql;

-- Create trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Manually create profiles for existing users
insert into public.profiles (id, email)
select id, email::text from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
