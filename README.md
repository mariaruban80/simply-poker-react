# Simply Poker React

React/Vite front end migration with the existing Express + Socket.IO backend retained as the compatibility layer.

## Development
Run `npm install`, then start `npm run dev:server` and `npm run dev` in separate terminals. Vite proxies `/api` and `/socket.io` to port 3000.

## Production
Run `npm run build` then `npm start`. Express serves `dist/` and retains existing API and Socket.IO handlers.

## Migration increment 1
- React/Vite application shell and responsive create/join flow.
- Initial session page and Socket.IO adapter using existing event names.
- Existing server logic retained as baseline.
- Remaining: complete story management, voting/reveal/statistics, CSV/Jira import/export, profile/language, feedback, About, privacy and terms; verify event payloads and add integration tests.

Never commit SMTP credentials, Jira API tokens, or other secrets. Use deployment environment variables.
