# Global Pipeline Manager

Global Pipeline Manager is a lightweight commercial pipeline management application.

## Current security model

The application uses Supabase Authentication and Row Level Security (RLS).

Access is restricted to:
- authenticated users
- users included in the `allowed_users` table
- active users only

User roles:
- `admin`
- `user`

Anonymous access to application data is disabled.

The `offers` Storage bucket is private and accessible only to authorized authenticated users.

## Architecture

Frontend:
- GitHub Pages

Backend:
- Supabase

Authentication:
- Supabase Auth

Database security:
- Row Level Security (RLS)
- `allowed_users` whitelist

Document storage:
- Private Supabase Storage bucket

## Important

Do not expose Supabase service role keys or other secret credentials in frontend files.

The Supabase publishable/anon key used by the browser is not a secret. Actual access to data is controlled by Authentication and RLS policies.

Database schema changes should be made using the appropriate versioned migration files rather than re-running an old initial schema.
