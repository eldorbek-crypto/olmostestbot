# Diamond Quiz Bot

Telegram quiz bot (`node-telegram-bot-api`) with JSON storage.
Auto mode:
- Render (`RENDER_EXTERNAL_URL` set) -> webhook
- Local (`RENDER_EXTERNAL_URL` not set) -> polling

## 1) Environment variables

Create `.env` locally (copy from `.env.example`) and set:

- `BOT_TOKEN` - Telegram bot token from BotFather
- `RENDER_EXTERNAL_URL` - Render service URL (only for Render deploy)

## 2) Run locally

```bash
npm install
npm start
```

## 3) Render setup

- Build Command: `npm install`
- Start Command: `npm start`
- Add env var: `BOT_TOKEN=<your_real_token>`
- Add env var: `RENDER_EXTERNAL_URL=https://...onrender.com`

## Important: avoid 409 conflict

One bot token can only have **one active polling process**.

In this project, Render uses webhook, so 409 conflict is much less likely.
Local mode still uses polling, so if you force polling in multiple places with same token, conflict can happen.
