# 10xCards

10xCards is a web application for turning pasted study material into editable flashcards and reviewing them with spaced repetition. Users can generate cards with AI, organize them into private sets, manage cards manually, and study cards when they become due.

## Features

- Email and password authentication
- Private flashcard sets protected with Supabase Row Level Security
- AI flashcard generation through OpenRouter
- Review, edit, and remove generated cards before saving
- Manual flashcard creation, editing, and deletion
- Spaced-repetition scheduling powered by FSRS
- Due-card summaries and set-based review sessions
- Polish and English interface
- Responsive layout for desktop and mobile browsers
- Account deletion

## Tech Stack

- [Astro](https://astro.build/) 7 with server-side rendering
- [React](https://react.dev/) 19 for interactive islands
- [TypeScript](https://www.typescriptlang.org/) 5
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Supabase](https://supabase.com/) for PostgreSQL, authentication, and RLS
- [OpenRouter](https://openrouter.ai/) for AI generation
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) for spaced repetition
- [Cloudflare Workers](https://workers.cloudflare.com/) for deployment
- [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/) for tests

## Prerequisites

- Node.js 22.19.0 (see `.nvmrc`)
- npm
- Docker for the local Supabase stack
- An OpenRouter API key to use AI generation

## Getting Started

1. Clone the repository and enter the project directory:

```bash
git clone https://github.com/Agrestor666/10xcards.git
cd 10xcards
```

2. Install dependencies:

```bash
npm install
```

3. Start the local Supabase stack:

```bash
npx supabase start
```

The repository already contains the Supabase configuration and migrations, so `supabase init` is not required. Supabase Studio is available at `http://localhost:54323`.

4. Create local environment files:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example .dev.vars
```

5. Copy the local API URL, anon key, and service-role key printed by `npx supabase start` into both files. Add your OpenRouter key:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
OPENROUTER_API_KEY=<openrouter-api-key>
```

Keep real secrets out of version control.

6. Start the development server:

```bash
npm run dev
```

The application is available at `http://localhost:4321`.

Local email confirmation is disabled in `supabase/config.toml`. Emails produced by other local authentication flows can be inspected in Inbucket at `http://localhost:54324`.

## Environment Variables

| Variable                    | Required                    | Purpose                                              |
| --------------------------- | --------------------------- | ---------------------------------------------------- |
| `SUPABASE_URL`              | Yes                         | Supabase project API URL                             |
| `SUPABASE_KEY`              | Yes                         | Supabase anon/publishable key used by the SSR client |
| `SUPABASE_SERVICE_ROLE_KEY` | For account deletion        | Server-only administrative key                       |
| `OPENROUTER_API_KEY`        | For AI generation           | Server-only OpenRouter API key                       |
| `E2E_USER_EMAIL`            | For authenticated E2E tests | Test account email                                   |
| `E2E_USER_PASSWORD`         | For authenticated E2E tests | Test account password                                |
| `PLAYWRIGHT_BASE_URL`       | No                          | Overrides the Playwright base URL                    |

The application secrets are declared as server-only fields in `astro.config.mjs`. Never expose the service-role or OpenRouter keys to client-side code.

## Available Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production SSR build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run lint:fix` — fix supported ESLint issues
- `npm run format` — format the repository with Prettier
- `npm test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode
- `npm run test:db` — run local pgTAP database and RLS tests
- `npm run test:e2e` — run Playwright tests
- `npm run test:e2e:ui` — open the Playwright test UI

## Project Structure

```text
.
├── e2e/                    # Playwright tests
├── public/                 # Static assets
├── src/
│   ├── components/         # Astro and React components
│   ├── layouts/            # Shared Astro layouts
│   ├── lib/                # Services, helpers, i18n, and SRS logic
│   ├── pages/
│   │   ├── api/            # Server API routes
│   │   ├── auth/           # Authentication pages
│   │   └── sets/           # Set details and review sessions
│   ├── middleware.ts       # Authentication and locale middleware
│   └── types.ts            # Shared application types
├── supabase/
│   ├── migrations/         # Database migrations
│   ├── tests/database/     # pgTAP database and RLS tests
│   ├── seed.sql            # Local seed file
│   └── config.toml         # Local Supabase configuration
├── astro.config.mjs
├── playwright.config.ts
└── wrangler.jsonc
```

## Main Routes

| Route                 | Description                                  |
| --------------------- | -------------------------------------------- |
| `/`                   | Public landing page                          |
| `/auth/signup`        | Account registration                         |
| `/auth/signin`        | Sign in                                      |
| `/auth/confirm-email` | Email-confirmation guidance                  |
| `/dashboard`          | Flashcard sets, due counts, and AI generator |
| `/sets/:id`           | Manage a set and its flashcards              |
| `/sets/:id/review`    | Run an SRS review session                    |
| `/settings`           | Language and account settings                |
| `/api/health`         | Generic production configuration health      |

The `/dashboard`, `/sets/*`, and `/settings` routes require authentication.

## Database

Migrations live in `supabase/migrations/`. The primary application tables are:

| Table            | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `flashcard_sets` | User-owned named sets                          |
| `flashcards`     | Question/answer cards and SRS scheduling state |

RLS policies restrict rows to their authenticated owner.

Apply all migrations to a fresh local database:

```bash
npx supabase db reset
```

This command destroys local database data before replaying migrations.

To use a hosted project:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Testing

Run unit tests:

```bash
npm test
```

With the local Supabase stack running, test database policies:

```bash
npm run test:db
```

For authenticated browser tests, set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` in `.env`, then run:

```bash
npm run test:e2e
```

Playwright starts the development server automatically unless one is already running. Tests use `http://localhost:4321` by default.

## Deployment

Pushes and pull requests to `master` run a production dependency audit, linting, unit tests, a production build, local pgTAP policy tests, and the full Playwright suite. CI creates an ephemeral local Supabase stack and test user, so integration tests do not use production credentials.

After all required checks pass on a push to `master`, the workflow deploys the `10xcards` Worker and performs smoke checks against `/`, `/auth/signin`, and `/api/health` at `PRODUCTION_URL`.

Required GitHub configuration:

- Secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_API_TOKEN`
- Repository variable: `PRODUCTION_URL`

Production Worker secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put OPENROUTER_API_KEY
```

Manual deployment:

```bash
npm run build
npx wrangler deploy
```

See [`context/changes/deploy-pipeline/change.md`](context/changes/deploy-pipeline/change.md) for the operator checklist.
