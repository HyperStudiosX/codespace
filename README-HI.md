# HyperForgeX AI Discord Bot — Mobile Setup

Yeh Node.js + discord.js starter project hai. Bot normal chatting ke liye `CHAT_API_KEY` aur file development ke liye `DEV_API_KEY` use karta hai. Dono providers OpenAI-compatible API format support karne chahiye.

## Commands

- `/enable` — tumhare account ke liye DM AI replies enable karta hai.
- `/disable` — DM AI replies disable karta hai aur saved chat history clear karta hai.
- Koi `/ask` command nahi hai. Enable karne ke baad bot ko DM mein seedha message bhejo.
- Bot server ke normal text channels mein chat nahi karta; direct messages mein hi reply karta hai.

## Mobile par files kaise banao

Phone par ZIP ko extract karna aur files edit karna mumkin hai, lekin bot ko 24/7 chalane ke liye Node.js environment chahiye. Recommended: VPS/Pterodactyl ya GitHub Codespaces/Node hosting. Sirf Android file manager mein files save karne se bot online nahi hota.

### 1. ZIP extract karo
Saari files ek folder mein extract karo. `system.yml` aur `.env.example` root folder mein hi rehne chahiye.

### 2. `.env` banao
`.env.example` ki copy bana kar uska naam `.env` rakho. Apni values bharo:
- `DISCORD_TOKEN`: Discord Developer Portal > Bot > Token
- `DISCORD_CLIENT_ID`: Application ID
- `CHAT_API_KEY`, `CHAT_BASE_URL`, `CHAT_MODEL`
- `DEV_API_KEY`, `DEV_BASE_URL`, `DEV_MODEL`

API keys ya bot token kisi ko mat bhejna aur GitHub par `.env` upload mat karna.

### 3. Discord Developer Portal
- Application banao aur Bot add karo.
- Bot ko apne server mein invite karo with `bot` and `applications.commands` scopes.
- Bot settings mein **Message Content Intent** enable karo, kyunki bot DM ka plain text read karta hai.
- Bot token aur Application ID `.env` mein set karo.

### 4. Install and run
Node.js 20+ environment ke terminal mein:
```bash
npm install
npm run deploy
npm start
```
Agar commands sirf testing server par jaldi register karne hain, `.env` mein `DISCORD_GUILD_ID=YOUR_SERVER_ID` set karke `npm run deploy` chalao. Public/global commands show hone mein kuch waqt lag sakta hai.

### 5. Use
1. Bot ko DM kholo.
2. `/enable` run karo.
3. Ab seedha normal question bhejo, jaise `Paper server start nahi ho raha, ye console log explain karo`.
4. File banane ke liye `Create a complete config.yml for ...` likho.
5. Existing text config upload karke changes batao.
6. `/disable` se DM AI band karo.

## Live internet search
Live search ke liye `.env` mein `TAVILY_API_KEY` set karo. Agar blank hai to bot AI model ke built-in knowledge se jawab dega, live web search nahi karega. API provider ki rate limits, supported models aur billing apply hoti hain.

## system.yml
`system.yml` se language, supported extensions, behavior aur rules configure hote hain. YAML edit karne ke baad bot restart karo.

## File support and limitations
- Text-based configs/code are supported; binary files, images, archives and executable files are not edited by this starter.
- YAML and JSON basic syntax validation hoti hai. JS, shell, TOML and plugin-specific semantics ki full validation guaranteed nahi.
- Generated scripts execute nahi hote. Production server par use karne se pehle review/test karo.
- AI ko har free/paid plugin ki complete knowledge guaranteed nahi; live web search aur official documentation se verification help milti hai.
- Discord embed and upload limits apply. Output file size default 8 MB hai; `.env` mein adjust kar sakte ho.

## Troubleshooting
- `Used disallowed intents`: Discord Developer Portal mein Message Content Intent enable karo.
- `Missing CHAT_API_KEY` / `Missing DEV_API_KEY`: `.env` values check karo.
- `/enable` nahi dikh raha: `npm run deploy` dobara chalao; global commands ko appear hone mein waqt lag sakta hai.
- `401` from AI: key, base URL aur model provider ke dashboard mein verify karo.
- Bot offline: hosting process/terminal check karo; bot ko continuously running host chahiye.
