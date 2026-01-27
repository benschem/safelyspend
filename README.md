# Budgeting tool

A personal budgeting and forecasting tool that helps users manage their finances.

User data is only stored locally in the browser. This does make using it across multiple browsers or sharing an account more difficult, as you need to import and export user data as JSON. In a future release I plan to address this by storing user data as encrypted JSON blobs on Cloudflare R2 and using workers for upload/ecrypt and download/decrypt.

This is the first time I've used Claude CLI to help me finish a project, and it was a surpisingly good experience. Despite a significant portion of the code being written by AI, I like to think I understand this codebase reasonably well and it's still representative of my architectural decisions.

## Features

- Track income, expenses and savings
- Define categories (e.g. groceries, rent, entertainment, savings)
- Forecast expenses per category
- Compare actual spending to projected spending per category
- Check how much money is free to spend
- Estimate whether future obligations can be covered
- Simulate budget adjustments (e.g. "What happens if I reduce dining out by $100 per month?").

## Tech stack

- NPM
- React 19
- React Router 7
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- ESLint
- Prettier

Budget data is stored locally on device - no database.

## Setup instructions

```zsh
npm install
npm run build
```

## Command line

```zsh
npm run dev # start a dev server with vite
npm run build # build with vite
npm run preview # serve the latest build
npm run lint # see linting issues with eslint
npm run lint:fix # fix linting issues with eslint
npm run format # see formatting issues with prettier
npm run format:fix # fix formatting issues with prettier
```
