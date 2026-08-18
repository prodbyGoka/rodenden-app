# Хостирање на Vercel

## 1. Отпакувај и стави на GitHub
unzip rodenden-app.zip
cd rodenden-app
git init && git add . && git commit -m "init"
# создај repo на GitHub и push-ни

## 2. Vercel
- New Project -> import repo
- Framework preset: **Other**
- Build command: `npm run build`  (или `bun run build`)
- Output: остави автоматски

## 3. Environment Variables (Settings -> Environment Variables)
NITRO_PRESET=vercel
VITE_SUPABASE_URL=https://mnpprbgzkpbntizmiobi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_A9ZWLwa0XCTFrsRhJ05Byw_ckLK_9v4
VITE_SUPABASE_PROJECT_ID=mnpprbgzkpbntizmiobi
SUPABASE_URL=https://mnpprbgzkpbntizmiobi.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_A9ZWLwa0XCTFrsRhJ05Byw_ckLK_9v4
SUPABASE_SERVICE_ROLE_KEY=<од твојот Supabase проект: Settings -> API>
SESSION_SECRET=<долг случаен текст, мин. 32 знаци>
SITE_PASSWORD=<твојата админ пасворд>

Важно: `NITRO_PRESET=vercel` е задолжително (инаку билдот е за Cloudflare).
База: истата Supabase база веќе има табели `guests` и `event_settings`,
па не треба нови миграции. Ако сакаш нова база, пушти ги SQL фајловите од `supabase/migrations/`.
