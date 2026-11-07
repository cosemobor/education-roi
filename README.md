# Higher Education Outcomes (edu.hamindex.com)

Next.js 16 app ranking majors and colleges by graduate earnings, built on the
U.S. Department of Education College Scorecard.

## Data — no database

The site has no runtime database. The app-ready data lives in `src/data/*.json`
(committed) and is bundled into the deploy, indexed in memory by
`src/lib/data/store.ts`. The home page and `/api/majors` are fully static;
`/majors/[cipCode]`, `/schools/[unitId]`, `/api/programs` and `/api/schools`
render on demand from the bundled data.

Refresh pipeline (run locally):

```bash
# needs SCORECARD_API_KEY in .env.local (free: https://api.data.gov/signup/)
npx tsx scripts/fetch-scorecard.ts     # API → data/raw-*.json (gitignored)
npx tsx scripts/process-scorecard.ts   # raw → src/data/*.json (committed)
git add src/data && git commit && git push   # Vercel redeploys
```

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
