# Higher Education Outcomes (edu.hamindex.com)

Next.js 16 app ranking majors and colleges by graduate earnings, built on the
U.S. Department of Education College Scorecard.

## Data — no database

The site has no runtime database. The app-ready data lives in `src/data/*.json`
(committed) and is bundled into the deploy, indexed in memory by
`src/lib/data/store.ts`. The home page and `/api/majors` are fully static;
`/majors/[cipCode]`, `/schools/[unitId]`, `/api/programs` and `/api/schools`
render on demand from the bundled data.

Refresh pipeline (run locally, in this order):

```bash
# 1. Download the full Scorecard archive ("Download All Data", ~560MB) from
#    https://collegescorecard.ed.gov/data/ into data/scorecard-archive/ (gitignored)
# 2. Institutions from the API — needs SCORECARD_API_KEY in .env.local
#    (free: https://api.data.gov/signup/)
npx tsx scripts/fetch-scorecard.ts        # → data/raw-institutions.json
# 3. Programs from the bulk Most-Recent field-of-study file (the API omits ~4% of programs)
npx tsx scripts/programs-from-bulk.ts     # → data/raw-programs.json + data/release.json
# 4. Census earnings-by-age curves for the ROI career view (needs CENSUS_API_KEY)
npx tsx scripts/build-age-profiles.ts     # → src/data/age-profiles.json
# 5. Site data incl. ROI (src/lib/roi.ts) + a dated snapshot of this release
npx tsx scripts/process-scorecard.ts      # → src/data/*.json, snapshots/scorecard-<release>.json.gz
# 6. Over-time data
npx tsx scripts/build-school-history.ts   # cost 2009-10→latest + earnings checkpoints → src/data/school-history.json
npx tsx scripts/build-major-history.ts    # ACS wages by field of degree → src/data/major-history.json
                                          #   (needs CENSUS_API_KEY; reads ../HAM/.env.local if missing here)
git add src/data snapshots && git commit && git push   # Vercel redeploys
```

Rankings default to 7-year earnings (then 5-, then 1-year). ROI is the NPV of the
earnings premium over a high-school graduate minus cost (net price + forgone wages),
discounted at the S&P 500's 2000–2025 total return (5.31% real) — see src/lib/roi.ts. `snapshots/` keeps
one compressed copy per Scorecard release so the site accumulates its own
consistent history; it is committed but not used by the running site.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
