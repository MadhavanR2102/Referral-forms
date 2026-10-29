# Referral Forms Prototype

Public preview: https://madhavanr2102.github.io/Referral-forms/

This repository contains the referral form builder prototype and its prebuilt GitHub Pages site in `docs/`. The public preview does not require a password.

## Prototype Features

- Referral form lists and details.
- Standalone fields, optional sections, inline editing and drag-and-drop.
- Nineteen field templates and seven section templates.
- Memory-only preview answers, validation and conditional visibility.

Use synthetic data only. This is not a clinical system. Saving drafts, publishing referrals, AI generation and live SNOMED search are not connected to production services. Answers are not persisted.

## Development

Use Node 22.13 or later and pnpm. Source imports EMIS UI packages, so rebuilding requires appropriate package-read access. Never commit registry credentials or environment files.

```sh
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm build:pages
```

The Pages build uses hash routing and the `/Referral-forms/` asset base so links work on static hosting. GitHub Pages serves the `docs/` folder on `main`. After editing the source, regenerate `docs/` with `pnpm build:pages`, commit the updated source and output, and push to `main`.