# UZDARUS Secure Platform Deployment

## 1) Install dependencies

```bash
npm install
```

This installs `firebase-admin` for Vercel serverless endpoints in `/api`.

## 2) Configure environment variables

Set the variables from `.env.example` in your host (Vercel Project Settings → Environment Variables).

Required:
- `FIREBASE_SERVICE_ACCOUNT_KEY`

Or use split variables:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

If you still run `server/server.js`, also set:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `TELEGRAM_CONTACT_TOKEN`
- `TELEGRAM_PAYMENT_TOKEN`
- `TELEGRAM_CHAT_ID`

## 3) Deploy Firestore rules

Deploy `firestore.rules` to Firebase:

```bash
firebase deploy --only firestore:rules
```

## 4) Entry points

- Public demo pages: `a1-demo.html`, `a2-demo.html`, `b1-demo.html`, `b2-demo.html`
- Paid login: `my.cabinet/index.html`
- Paid dashboard: `my.cabinet/dashboard.html`
- Admin panel: `adminpanel.html`

## 4.1) Bootstrap developer account (one-time)

After setting Firebase Admin env variables, run:

```bash
npm run ensure:developer
```

The command will:
- find existing `developer` role user, or create one if missing
- reset/generate a secure temporary password
- set `forcePasswordChange = true`
- set custom claim `role=developer`
- print login and temporary password once

## 5) API endpoints (server-side only)

Auth:
- `POST /api/auth/register-device`
- `GET /api/auth/me`

Admin:
- `GET /api/admin/list-users`
- `POST /api/admin/create-user`
- `POST /api/admin/reset-password`
- `POST /api/admin/set-subscription`
- `POST /api/admin/unblock-user`
- `POST /api/admin/clear-devices`
- `POST /api/admin/set-role`

## 6) Security model summary

- No public self-registration flow (`auth.html` redirects to cabinet).
- Paid pages are guarded by auth + subscription + pack + device limit checks.
- Device count is capped at 3 and enforced in a transaction (`register-device`).
- Admin actions are RBAC-restricted server-side (`developer > admin > moderator > customer`).
- Firestore rules restrict user data access to owner/staff and block open writes.
