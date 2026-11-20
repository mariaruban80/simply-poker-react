# Simply Poker React

React/Vite front end migration for Simply Poker. The existing Express + Socket.IO backend is retained as the compatibility layer. This repository is separate from the original `Simplypoker-Prod` repository.

## Development

1. Install dependencies: `npm install`
2. Start the backend: `npm run dev:server`
3. Start Vite in a second terminal: `npm run dev`

Vite proxies `/api` and `/socket.io` to the backend on port 3000.

## Production

1. Build the React application: `npm run build`
2. Start Express: `npm start`

Express serves the production `dist/` bundle and retains the existing API and Socket.IO handlers.

## Current migration coverage

- React/Vite create and join session flow.
- Host and guest roles, host release/request and transfer.
- Shared session permissions for delegated story management.
- Story create, update, delete, search and navigation.
- CSV import with preview and CSV export.
- JIRA project connection, JQL search, issue filtering and import.
- Voting decks: Fibonacci, Short Fibonacci, T-Shirt, T-Shirt + Numbers and Custom.
- Real-time voting, private vote indicators, reveal/reset, vote statistics and story points.
- Reconnection and server-state restoration for stories, votes, voting scale, permissions and story points.
- Profile menu, saved language preference, local session timer and feedback.
- About/help page, Contact Us, Privacy Policy and Terms of Service dialogs.

## Verification

- `npm run build` — React production build.
- `npm test` — Vitest unit tests.
- `npm run test:integration` — two-client Socket.IO integration test covering joining, permissions, story CRUD, voting, reveal/reset and host transfer.
- `node --check server.js` — server syntax validation.
- CI runs a production dependency audit with `npm audit --omit=dev --audit-level=high`.

## Deployment configuration

Set `PORT` in the hosting environment.

For feedback and Contact Us email delivery, configure either:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`; or
- `EMAIL_USER`, `EMAIL_PASS` for the Gmail transport.

Also set `EMAIL_TO` to the intended feedback/contact recipient. Do not commit SMTP credentials, JIRA API tokens, or other secrets. JIRA credentials are supplied by the user when connecting and are not persisted by the React UI.

## Items requiring final operational validation

- Full interface translation is not yet implemented; the language selector currently saves the user's preference only.
- The timer currently runs locally in the browser and is not synchronised between participants.
- JIRA import must be tested with a real authorised Atlassian project and token.
- Feedback and Contact Us email delivery must be verified using the production SMTP settings.
- Privacy Policy and Terms text are draft notices and must be reviewed against the actual service, hosting, retention and ownership arrangements before publication.
- Complete browser-based acceptance testing on desktop and mobile, then deploy to a staging environment before replacing production.

The original `Simplypoker-Prod` repository is not modified by this migration.


## Android and iOS apps (Capacitor)

The web application remains the primary shared React codebase. Capacitor packages the built React app into native Android and iOS shells; it does not replace the existing web deployment or Express/Socket.IO server.

### First-time native setup

1. Install the project dependencies: `npm install`.
2. Add the native projects once: `npx cap add android` and `npx cap add ios`.
3. Install Android Studio for Android builds. iOS builds require macOS with Xcode.

### Point mobile builds at the deployed Render service

Create a local `.env.production.local` file (do not commit production secrets) and set both values to the public HTTPS URL of the Render web service:

```dotenv
VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
VITE_PUBLIC_APP_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

These values are read at build time. Then run:

```bash
npm run cap:sync
npm run cap:open:android
# or
npm run cap:open:ios
```

For normal browser development, leave these variables unset: API requests and Socket.IO will continue to use the current same-origin setup. The mobile apps use the configured Render URL for API calls, live rooms, and copied invite links. The invite links remain ordinary web URLs, so recipients can join from a browser.

The current native application identifier is `com.simplypoker.app`; confirm the permanent identifier before publishing to either app store. Native project generation and signing are local build steps and are not performed by GitHub source edits.
