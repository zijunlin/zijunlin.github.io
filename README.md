# Personal website

A personal website built with Vite and published to GitHub Pages.

## Local development

Requires Node.js 22.12 or later. Tests for repository tools also require ripgrep (`rg`).

```sh
npm ci
npm run dev
```

## Build and check

```sh
npm test
npm run test:smoke
npm run test:browser
npm run build
```

Browser checks require Chrome (`npx playwright install chrome` if it is not installed). Run build and test commands sequentially because they share build output.

## Deployment

[GitHub Actions](.github/workflows/pages.yml) checks pull requests and builds and deploys `dist/` on pushes to `master`. The workflow also supports manual runs. Configure the repository's Pages source as **GitHub Actions**.
