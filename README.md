# House Chat

Standalone messenger-style microfrontend for the House Five platform.

**Version:** 0.1.0

This repo intentionally does **not** modify the main `house-five` repository. It can run independently now and later be mounted under `/chat` through a House Five/Vercel rewrite.

## Included now

- Full-screen chat world with only the House Five home control and chat UI
- Household group conversation and direct-message UX
- Responsive mobile conversation drawer
- Message composer that supports Enter to send and Shift+Enter for a new line
- Search across conversations and inside the active conversation
- Reactions, reply interaction, unread state, theme toggle, and local persistence
- Standalone demo mode plus a documented future integration bridge
- `/api/health` endpoint for deployment checks
- `/chat` path compatibility for future proxy/rewrite integration

## Local verification

```bash
npm run check
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Security boundary

House Five must remain the source of truth for identity and household membership. Do not trust `userId`, `houseId`, or role values sent only by browser code. See `ARCHITECTURE.md`.
