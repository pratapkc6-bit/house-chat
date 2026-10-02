# House Chat architecture boundary

This repository follows the House Five microfrontend decision record dated 2 October 2026.

## Ownership

House Chat owns its messenger-style UI, conversation state, message delivery integration, and future chat-specific tables/API routes. House Five core remains the canonical owner of user identity, household membership, roles, account management, payments, cleaning, tasks, and other household data.

## Current mode

Version 0.1.0 is a standalone functional preview. It stores preview conversations in `localStorage` so the UI can be tested without changing House Five or requiring production credentials.

## Future House Five integration contract

The host will eventually route `/chat` to this deployment. House Chat should receive verified identity from a server-side integration, not trust arbitrary browser-supplied user IDs.

Expected context shape for the browser UI after the server has verified the session:

```js
window.HouseFiveChat.configure({
  user: { id, displayName, initials, role, houseId },
  members: [{ id, displayName, initials, online }],
  apiBase: '/api/chat',
  returnUrl: '/'
})
```

The eventual chat API should verify the House Five session on every protected request and ensure the caller belongs to the conversation's house. Use HttpOnly cookies or another secure server-side session mechanism, CSRF protection for state-changing requests, and least-privilege database credentials.

Suggested module-owned tables: `chat_conversations`, `chat_participants`, `chat_messages`, `chat_reactions`, `chat_receipts`.
