# VaekstNet Dashboard

Intern marketing & sales dashboard med login, live HubSpot data og automatisk sync.

---

## Opsætning — trin for trin

### Trin 1 — Installer Node.js
Download fra nodejs.org (vælg LTS-versionen) hvis du ikke har det.

### Trin 2 — Pak projektet ud og åbn en terminal i mappen

### Trin 3 — Installer dependencies
```bash
npm install
```

### Trin 4 — Sæt passwords op
```bash
node setup-passwords.js
```
Du bliver bedt om at indtaste et password for hver bruger.
Scriptet gemmer automatisk de krypterede passwords i koden.

### Trin 5 — Udfyld .env.local
Åbn filen `.env.local` og udfyld:

```
HUBSPOT_API_KEY=pat-eu1-xxxxxxxxxxxxxx
NEXTAUTH_SECRET=vaekstnet-dashboard-hemmeligt-2026
NEXTAUTH_URL=https://dit-projekt.vercel.app
CRON_SECRET=sync-vaekstnet-2026
```

**HUBSPOT_API_KEY** — find den i HubSpot:
Settings → Integrations → Private Apps → din app → Access token

**NEXTAUTH_SECRET** — vælg en lang streng, fx: vaekstnet-dashboard-hemmeligt-2026

**CRON_SECRET** — vælg et ord du husker, fx: sync-vaekstnet-2026

### Trin 6 — Test lokalt (valgfrit)
```bash
npm run dev
```
Åbn http://localhost:3000

---

## Deploy til Vercel

1. Push koden til et privat GitHub repository
2. Gå til vercel.com → New Project → Import dit repo
3. Tilføj environment variables (de fire fra .env.local)
4. Klik Deploy
5. Besøg https://dit-projekt.vercel.app/api/sync én gang for første datasynkronisering

Herefter kører automatisk sync kl. 06:00 og 18:00 UTC dagligt.
Du kan også klikke "Sync nu" knappen i dashboardet.

---

## Tilføj eller skift brugere
1. Åbn setup-passwords.js og rediger listen øverst
2. Kør: node setup-passwords.js
3. Deploy igen til Vercel
