# TellMeMore — Alpha Deploy Instructions

## Files in this release

```
server.js           ← main server (renamed from tellmemore-server-final.js)
app.html            ← frontend SPA (renamed from tellmemore-app-final.html)  
questions.js        ← question bank + result engine
migrations.js       ← DB migration runner
railway.toml        ← Railway config
package.json        ← Node.js project file
.env.example        ← required environment variables
```

## Step 1: Set Railway environment variables

In Railway dashboard → your service → Variables tab, set:

| Variable | Value | Required |
|---|---|---|
| `ADMIN_PASS` | strong password | YES — change the default |
| `BASE_URL` | `https://tellmemore-production.up.railway.app` | YES |
| `RESEND_API_KEY` | from resend.com | NO for alpha, YES before soft launch |

## Step 2: PowerShell — copy files to your repo

```powershell
cd C:\tellmemore

# Copy all production files
Copy-Item "server.js"     "server.js"     -Force
Copy-Item "app.html"      "app.html"      -Force
Copy-Item "questions.js"  "questions.js"  -Force
Copy-Item "migrations.js" "migrations.js" -Force
Copy-Item "railway.toml"  "railway.toml"  -Force
Copy-Item "package.json"  "package.json"  -Force

# Verify imports are correct
Select-String -Path "server.js" -Pattern "require\("

# Confirm no old tellmemore- prefix references remain
$check = Select-String -Path "server.js" -Pattern "tellmemore-"
if ($check) { Write-Host "WARNING: old prefix found" } else { Write-Host "OK: no old prefix" }
```

## Step 3: Commit and push

```powershell
git add server.js app.html questions.js migrations.js railway.toml package.json
git commit -m "feat: soft-launch candidate v2

Hard blockers resolved:
- Owner return flow (email + magic link auth)
- Question-to-signal mapping (31 questions, 7 signals, result engine)
- Public share/teaser page (/s/:shareId) with OG meta
- Referral attribution (ref + src fields, referrals table)
- XSS sanitization + CSP header
- WhatsApp/Instagram browser compat (clipboard fallback, no fixed CTAs)
- DB migration system (schema_version, v1+v2)

Must-fixes resolved:
- OG meta tags on share page
- Correct anonymity copy
- /privacy and /terms pages
- Response delete + report
- Rate limiting (profile/response/auth)
- 6 core analytics events
- Admin dashboard with basic auth
- Unlock gate thresholds (1/3/5/7/10 responses)"

git push origin main
```

## Step 4: Post-deploy smoke test

After Railway deploy completes (watch logs for "[TMM] Server running"):

```
curl -I https://tellmemore-production.up.railway.app/
curl https://tellmemore-production.up.railway.app/privacy | head -20
curl -u "admin:YOUR_ADMIN_PASS" https://tellmemore-production.up.railway.app/admin | head -30
```

## Step 5: Full smoke test (manual)

1. Create a test profile → get share URL
2. Open share URL in WhatsApp → paste → OG preview should appear
3. Open /s/:shareId from mobile → see teaser, click answer
4. Complete all questions → "Thank you" screen
5. Return to owner browser → results page shows tier
6. Click "Return to my results" from fresh browser → enter email → click link → authenticated

## Step 6: Internal alpha — 3–5 person test group

Only after smoke test passes. Share direct /s/:shareId links, not root URL.
Collect: response count per profile, any errors, mobile experience.

## Known alpha limitations

- RESEND_API_KEY not set: magic links are returned in the API response body only.
  For alpha testers, they must stay logged in from their original browser.
  Set RESEND_API_KEY before expanding beyond 5 users.
- No push notifications
- Admin password via HTTP basic auth only — change ADMIN_PASS before soft launch
