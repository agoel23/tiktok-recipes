# Recipe Book

Paste a TikTok, Instagram or recipe-website link. You get a clean recipe with an ingredient checklist, step-by-step directions and a servings scaler. Each recipe is classified by cuisine and saved permanently, even if the original post is deleted. The site is mobile-first and hosted on GitHub Pages: anyone with the link can browse, and only you can add recipes.

```
Phone ──► GitHub Pages site ──► Supabase (recipes, job queue, thumbnails, your login)
                                    ▲
                     Mac worker ────┘  yt-dlp / page parser → Groq Whisper → Claude
```

- **web/**: the React + Vite site. It only uses Supabase's public anon key, and Row-Level Security decides what each visitor can do.
- **worker/**: a Python daemon on your Mac. It picks up queued links, downloads the video or page, transcribes the narration, and asks Claude for a structured recipe. If your Mac is off, links wait in the queue as "Queued".
- **supabase/migrations/**: the database schema, access policies and storage bucket.

## One-time setup

1. **Supabase** (free): go to [supabase.com](https://supabase.com) and create a project.
   - In the **SQL Editor**, paste and run `supabase/migrations/001_init.sql`.
   - Go to **Authentication → Users → Add user** and create your account with an email and password.
   - Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up".
   - From **Project Settings → API**, copy the Project URL, the `anon` key and the `service_role` key.
2. **API keys**: get an [Anthropic API key](https://console.anthropic.com) for recipe extraction and a [Groq API key](https://console.groq.com) for Whisper transcription.
3. **Worker secrets**: copy `worker/.env.example` to `worker/.env` and fill it in.
4. **Web config**: copy `web/.env.example` to `web/.env` and fill it in with the URL and anon key.
5. **Instagram**: stay logged into instagram.com in Chrome. The worker borrows that session. The first time, macOS will ask to let Python read "Chrome Safe Storage"; choose *Always Allow*.

## Run it locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r worker/requirements.txt
.venv/bin/python -m worker add "https://www.tiktok.com/@someone/video/123"   # queue a link
.venv/bin/python -m worker run-once                                          # process the queue
.venv/bin/python -m worker reextract tiktok-123                              # re-run Claude on a saved recipe

cd web && npm install && npm run dev      # open the printed URL (use your phone on the same Wi-Fi)
npm test                                  # scaling unit tests
```

## Run the worker in the background

```bash
./scripts/install-worker.sh     # starts at login, restarts on crash; logs: ~/Library/Logs/recipe-book.log
./scripts/uninstall-worker.sh
```

macOS blocks background processes from reading `~/Desktop`, so the installer copies the worker to `~/.recipe-book`. **Re-run the installer after changing worker code or `worker/.env`.**

## Deploy the site (GitHub Pages)

1. Push this folder to a GitHub repo. The repo must be public for free Pages; it contains no secrets or recipe data.
2. Go to **Settings → Pages** and set **Source** to "GitHub Actions".
3. Go to **Settings → Secrets and variables → Actions → Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Every push to `main` that touches `web/` redeploys the site to `https://<you>.github.io/<repo>/`.

On your iPhone, open the site in Safari, then tap **Share → Add to Home Screen**.

## Adding recipes from your phone

1. In TikTok or Instagram, tap **Share → Copy link**.
2. In the app's **Add** tab, tap **Paste**, then **Add recipe**.
3. The link is processed the next time the worker runs. That's within about 10 seconds if your Mac is awake.

If a download fails (a private post, a photo post, or a site that blocks bots), tap **Paste text instead** on the failed item and paste the caption or recipe text.

## Notes

- **Missing measurements:** when the source doesn't give amounts, Claude makes a best guess. Guessed amounts show a **~** and the recipe shows a warning banner. Times that weren't stated are marked ~ too.
- **Cuisines:** the list lives in `shared/cuisines.json` and is used by both the worker and the site.
- **When TikTok or Instagram downloads break:** run `.venv/bin/pip install -U yt-dlp`, then re-run `./scripts/install-worker.sh`.
- **Supabase pausing:** free projects pause after 7 days with no activity. Visiting the site or running the worker keeps the project awake.
