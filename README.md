# Aniekanvas Aesthetics

Next.js + Neon Postgres + Vercel rebuild of the Aniekanvas Aesthetics Squarespace site, with a built-in advanced CMS.

## Stack

- **Frontend:** Next.js 16 (App Router), React, Tailwind CSS
- **Database:** Neon Postgres via Prisma 7
- **CMS:** `/admin` — pages, services, FAQs, care guides, media, inquiries, site settings
- **Deploy:** Vercel

## Quick start (local, no DB)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Content is served from the scraped seed until Neon is connected.

CMS login (env bootstrap):

- Email: `admin@aniekanvas.com`
- Password: `aniekanvas-admin`

Override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Connect Neon + enable live CMS writes

1. Create a Neon project and copy the connection string.
2. Copy `.env.example` → `.env.local` and set:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=long-random-string
ADMIN_EMAIL=admin@aniekanvas.com
ADMIN_PASSWORD=choose-a-strong-password
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

3. Push schema and seed scraped content:

```bash
npm run db:push
npm run db:seed
```

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same env vars (`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`).
4. Deploy, then run seed once (local against production DB, or Vercel CLI):

```bash
DATABASE_URL=... npm run db:push
DATABASE_URL=... npm run db:seed
```

5. Visit `/admin` to manage content.

## Site map

| Route | Content |
| --- | --- |
| `/` | Home |
| `/about` | About Anie |
| `/services` | Service index |
| `/services/[slug]` | Service detail |
| `/faqs`, `/faqs/[slug]` | FAQs |
| `/care`, `/care/[slug]` | Precare & aftercare |
| `/policies` | Policies |
| `/book-now` | Booking info + Acuity link |
| `/contact` | Consultation form |
| `/admin` | CMS |

Booking portal: [aniekanvasaesthetics.as.me](https://aniekanvasaesthetics.as.me)

## Content source

Scraped from the Squarespace site into `content-seed/` and structured for the CMS in `src/lib/content/seed-data.json`.
