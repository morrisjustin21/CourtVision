# CourtVision

A private, multi-device basketball tracker: teams, rosters, game-by-game box scores,
and league-wide stat leaders. Built with React + Vite, styled with Tailwind, and backed
by a Supabase (Postgres) database.

## 1. Set up the database

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `schema.sql` (in this folder) and click **Run**.
   This creates four tables (`teams`, `players`, `games`, `player_game_stats`) and
   locks them down so only a signed-in user can read or write.

## 2. Create your login (no public sign-up)

This app has no sign-up page on purpose — you're the only person who should have access.

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter an email and password you'll remember. Check "Auto Confirm User" if offered.
4. That's the login you'll use on the site.
5. Also go to **Authentication → Providers → Email** and turn **off** "Allow new users to sign up"
   so no one else could ever register an account, even if they found the site.

## 3. Run it locally (optional, to preview before deploying)

Requires [Node.js](https://nodejs.org) installed on your computer.

```bash
npm install
npm run dev
```

This starts the site at `http://localhost:5173`. The `.env` file already has your
Supabase URL and key filled in.

## 4. Push the code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create a new repository on github.com (keep it **private**), and follow the
"push an existing repository" instructions it shows you — something like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/courtvision.git
git branch -M main
git push -u origin main
```

Note: `.env` is in `.gitignore` and will **not** be pushed to GitHub — that's intentional.

## 5. Deploy on Vercel

1. Go to vercel.com → **Add New → Project** → import your `courtvision` GitHub repo.
2. Vercel will auto-detect it as a Vite project. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon/publishable key
3. Click **Deploy**. In about a minute you'll get a live URL you can open from your phone or laptop.

## Using the site

- **Teams** — add teams (mark your own with "This is my team"), click into a team to manage its roster.
- **Games** — log a game between any two teams, then click into it to enter each player's box score (points, rebounds, assists, etc.) — stats save per player as you go.
- **Leaders** — league-wide per-game averages across every game you've logged, sortable by stat.

## Updating the site later

Any time you want to change something, just tell me what you'd like changed, and once
you push the updated code to GitHub, Vercel redeploys automatically.
