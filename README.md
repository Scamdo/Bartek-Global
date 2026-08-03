# Atradius Prospect Pipeline

This package is a free shared web application.

## What is included

- shared prospect database
- autocomplete based on existing records
- dashboard filters
- topics by customer country
- topics by status
- open and closed counts
- overdue and upcoming deadlines
- expected premium KPI
- visible table export to CSV
- country summary report export to CSV
- JSON backup and import
- local fallback mode when Supabase is not configured

## Free deployment

### 1. Create a free Supabase project

- Open Supabase
- Create a new free project
- Open SQL Editor
- Run `supabase_schema.sql`
- Open Project Settings - API
- Copy:
  - Project URL
  - anon public key

### 2. Configure the app

Open `config.js` and paste the values:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "YOUR_PROJECT_URL",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY"
};
```

### 3. Publish with GitHub Pages

- Create a new public GitHub repository
- Upload all files from this folder
- Open Settings - Pages
- Select `Deploy from a branch`
- Select the `main` branch and root folder
- Save

GitHub will provide a public link.

## Important

The current database policies allow anyone with the link to read, add, edit and delete records.
This matches the simple shared-use requirement, but do not store highly confidential information.
