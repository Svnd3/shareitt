# ShareIt

ShareIt is a subscription-sharing marketplace for Kenya built with React, Vite, Tailwind CSS, and Supabase.

## Setup

1. Clone the repository:

   ```bash
   git clone <repo-url> shareit
   cd shareit
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file using the `.env.example` template:

   ```bash
   cp .env.example .env
   ```

4. Add your Supabase environment variables in `.env`:

   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Supabase schema

Use `supabase_schema.sql` to create the database tables and insert seed data.

```sql
-- Families table
create table families (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  host_name text not null,
  host_phone text,
  price_per_slot integer not null,
  total_slots integer not null,
  filled_slots integer default 0,
  is_verified boolean default false,
  whatsapp_group_link text,
  created_at timestamp default now()
);

-- Members table
create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  name text not null,
  phone text not null,
  email text,
  payment_confirmed boolean default false,
  joined_at timestamp default now()
);
```

Then add seed rows with:

```bash
psql < supabase_schema.sql
```

## Deployment to Vercel

1. Push the repository to GitHub.
2. Create a new Vercel project and connect your repository.
3. Set the environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. Deploy the project.

## Notes

- The app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Supabase access.
- The join flow opens a WhatsApp confirmation message automatically.
- The host flow creates a new family listing and opens WhatsApp for confirmation.
