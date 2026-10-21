# AGENTS.md

## Cursor Cloud specific instructions

This is a **Shopify Liquid theme** (Focal by Maestrooo v12.7.1) for the "Brisa" brand. There is no local build pipeline, no `package.json`, and no bundling step — JavaScript/CSS assets are pre-compiled and committed directly to `/assets/`.

### Tech Stack

- **Platform**: Shopify (hosted e-commerce)
- **Templating**: Liquid
- **Frontend**: Vanilla JS (Web Components), Flickity, PhotoSwipe
- **CSS**: Custom CSS (no preprocessor)
- **i18n**: 12 locales in `/locales/`

### Development Tools

- **Shopify CLI** (`shopify`): installed globally via npm at `~/.npm-global/bin/`. PATH is configured in `~/.bashrc`.
- **Linting**: `shopify theme check --path /workspace` — runs locally without store authentication.
- **Dev server**: `shopify theme dev --store <store-name>` — requires authentication (see below).

### Authentication for Dev Server

Running `shopify theme dev` requires two environment variables:

| Variable | Description |
|----------|-------------|
| `SHOPIFY_CLI_THEME_TOKEN` | Theme Access password (generated via the Theme Access app in the Shopify store admin) |
| `SHOPIFY_FLAG_STORE` | Store URL, e.g. `your-store.myshopify.com` |

Set `SHOPIFY_CLI_TTY=0` and `SHOPIFY_FLAG_FORCE=1` to disable interactive prompts in CI/headless environments.

### Running Without Authentication

- **Lint**: `shopify theme check --path /workspace` works without any store connection.
- **Dev server** (`shopify theme dev`): will NOT work without `SHOPIFY_CLI_THEME_TOKEN` and `SHOPIFY_FLAG_STORE`.

### Directory Structure

```
assets/       — CSS, JS, fonts, SVGs (pre-compiled, committed)
blocks/       — Liquid block templates (custom AI-generated blocks)
config/       — Shopify settings (settings_schema.json, settings_data.json)
layout/       — Theme layout (theme.liquid)
locales/      — Translation JSON (12 languages)
sections/     — Liquid section templates
snippets/     — Reusable Liquid snippets
templates/    — Shopify page/product/collection templates (JSON + Liquid)
temp/         — Temporary/draft block files
```

### Key Gotchas

- The nvm `.npmrc` warning (`has a globalconfig and/or a prefix setting`) is harmless and does not affect CLI functionality.
- Theme check exit code is 1 when offenses are found (this is expected — the codebase has pre-existing lint warnings/errors).
- There are no automated tests (unit/integration) for this theme — validation is done via `shopify theme check` and manual preview.
