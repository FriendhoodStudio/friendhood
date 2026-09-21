## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Git

Commit and push to `main` automatically once a change is working/verified — don't wait to be asked, and don't let local work pile up uncommitted. Skip this for genuinely experimental/in-progress work the user hasn't confirmed yet. Never commit `.env`/`.env.local`/`.env.production` or any other secret-bearing file.

This matters here specifically because a Sanity webhook triggers a Vercel production rebuild from GitHub's `main` branch on every Studio publish — if `main` falls behind local work, that automation silently rebuilds stale code.

**Deployment is fully automatic on push to `main`** (Vercel's native Git integration, confirmed working 2026-09-21) — never run `vercel --prod` manually, it's redundant and will just double-deploy.

**`preview` branch is deliberately NOT kept in lockstep with `main`.** It exists so the business partner has one stable link (`friendhood-git-preview-friendhood.vercel.app`) that always shows a real, working state of the site — not so every single commit is instantly visible there. Verify changes locally (dev server + browser) before ever touching git; only fast-forward `preview` to `main` (`git push origin main:preview`) in meaningful batches — end of a work session, or when explicitly asked to update what the partner sees — not after each individual commit.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
