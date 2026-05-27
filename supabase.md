# Supabase Setup & Integration Guide

Follow this guide to set up your Supabase database backend so that your snippets are stored securely in the cloud and synchronized instantly across your Windows PC, iPad, and mobile devices.

---

## Step 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New Project** and select an organization.
3. Enter a project name (e.g., `Copier`), set a secure database password, choose your nearest region, and click **Create new project**.
4. Wait a few minutes for your database to provision.

---

## Step 2. Execute SQL Database Schema
Once your project is ready, execute the following SQL to set up the database table, primary keys, Row Level Security (RLS) policies, and Realtime sync.

1. In the left-hand menu, click on **SQL Editor** (the terminal icon `>_`).
2. Click **New Query** (or use the default blank editor).
3. Paste the entire SQL block below into the editor:

```sql
-- 1. Drop existing table if it exists (for clean installation)
drop table if exists public.snippets;

-- 2. Create the snippets table
create table public.snippets (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text not null,
  order_index integer default 0 not null,
  user_id uuid references auth.users(id) on delete cascade
);

-- 3. Enable Row Level Security (RLS)
alter table public.snippets enable row level security;

-- 4. Set up security policies (Choose ONE option below)

-- Option A: Direct Public Access (Simplest & Recommended for private personal use)
-- This allows you to read/write/delete snippets without needing an authentication sign-in screen.
create policy "Enable select for all users" 
on public.snippets for select 
using (true);

create policy "Enable insert for all users" 
on public.snippets for insert 
with check (true);

create policy "Enable update for all users" 
on public.snippets for update 
using (true);

create policy "Enable delete for all users" 
on public.snippets for delete 
using (true);


-- Option B: Authenticated User Isolation (Use only if you plan to build an auth sign-in system)
-- Uncomment these if you want strict multi-user accounts where users only see their own cards.
/*
create policy "Users can view own snippets" on public.snippets for select using (auth.uid() = user_id);
create policy "Users can insert own snippets" on public.snippets for insert with check (auth.uid() = user_id);
create policy "Users can update own snippets" on public.snippets for update using (auth.uid() = user_id);
create policy "Users can delete own snippets" on public.snippets for delete using (auth.uid() = user_id);
*/

-- 5. Enable Supabase Realtime (Allows instant syncing across Windows and iPad without reloading!)
alter publication supabase_realtime add table public.snippets;
```

4. Click **Run** in the top right corner of the SQL editor. You should see a success message: `Success. No rows returned.`

---

## Step 3. Connect your React PWA App

To connect your Copier application, retrieve your Project Credentials:
1. In the Supabase sidebar, click on **Project Settings** (the gear icon ⚙️) -> **API**.
2. Locate your credentials in the **API Settings** panel:
   - **Project URL**: Copy the value under `Project URL` (e.g., `https://xxxxxx.supabase.co`).
   - **Anon Key**: Copy the value under `Project API keys` marked with `anon` and `public` tags.

3. Open the `.env` file in your project's root folder and replace the placeholders with your actual keys:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Save the `.env` file and **restart your development server**:
   - In your VS Code terminal, press `Ctrl + C` to stop the server, and run:
     ```bash
     npm run dev
     ```
5. The cloud sync status indicator in the top right of your Copier app will automatically turn into a **green checkmark wifi icon**, indicating that synchronization is active!

---

## Step 4. How Cloud-Sync Syncs Offline Data
Our sync engine uses an **Offline-First hybrid approach**:
1. **Immediate Visual Boot**: The app always loads cards from `localStorage` first, so the screen appears instantly.
2. **Cloud Pull**: The app queries Supabase in the background, pulls any new updates, and synchronizes the local cache.
3. **Database Write**: Adding, editing, or deleting snippets updates local state instantly and runs a background query to Supabase. If you lose connection, your updates are safely saved in your local cache, and sync will retry as soon as you are reconnected to the internet.
