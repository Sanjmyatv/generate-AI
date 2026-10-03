# GenerateAI

Template-driven AI image/video generation app (Next.js 16, TypeScript, Tailwind, Prisma 7 + Postgres).

## Local development

```bash
npm install
cp .env.example .env      # set DATABASE_URL to a Postgres connection string
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Deployment (Railway)

- Web service is deployed from the `main` branch of this repo; Postgres is a second service in the same project.
- Set `DATABASE_URL` on the web service to `${{Postgres.DATABASE_URL}}`.
- `npm run build` generates the Prisma client and builds Next.js (no database needed at build time).
- `npm run start` applies migrations, seeds the database only if it is empty, then starts Next.js.
- Health check: `GET /api/health`.
