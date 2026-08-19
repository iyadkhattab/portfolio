# Iyad Khattab — Portfolio Site

A premium, data-driven portfolio site with a built-in local admin panel — add or
edit projects and experience from your browser, no code editing required.

## Running it

You need [Node.js](https://nodejs.org) installed (no other dependencies — nothing
to `npm install`).

```
node server.js
```

Then open:

- **Site:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin.html

Leave the terminal running while you use the site or the admin panel — it's a
small local server that reads and writes `content.json` on your disk.

## Adding a project or experience entry

1. Go to http://localhost:3000/admin.html
2. Pick the **Projects** or **Experience** tab
3. Click **Add project** / **Add experience**, fill in the form, and click **Save**
4. Reload the live site — your change is there

Screenshots you upload in the admin panel are saved into `assets/uploads/` and
referenced automatically; the first image you add becomes a project's cover
image.

Everything you enter is stored in `content.json` in this folder — that one file
is the entire database. Back it up or put it in version control if you want a
history of changes.

## Deploying the finished site

The admin panel and `server.js` are for **local editing only**. When you're
ready to publish:

1. Run the site locally and get your content exactly how you want it
2. Deploy the whole folder (`index.html`, `project.html`, `content.json`,
   `assets/`) as a static site — GitHub Pages, Netlify, Vercel, etc. all work
3. `index.html` and `project.html` fetch `content.json` directly, so no server
   is required to view the published site — you just won't be able to edit it
   from the live URL. To make further changes, edit locally with
   `node server.js` running and redeploy the folder.

## File map

- `server.js` — local server + API (`/api/data`, `/api/projects`, `/api/experience`, `/api/upload`)
- `content.json` — all site content (single source of truth)
- `index.html` / `project.html` — the public site
- `admin.html` — the editor
- `assets/style.css` — design system and all styling
- `assets/app.js` — renders the public site from `content.json`
- `assets/admin.js` — powers the admin panel forms
- `assets/icons.js` — shared icon set
- `assets/uploads/` — images uploaded through the admin panel
