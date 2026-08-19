// -----------------------------------------------------------------------
// Local server for the portfolio site + admin panel.
// No dependencies — run with: node server.js
// Then open http://localhost:3000  (site)  and  http://localhost:3000/admin.html  (editor)
// -----------------------------------------------------------------------

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const CONTENT_PATH = path.join(ROOT, "content.json");
const UPLOADS_DIR = path.join(ROOT, "assets", "uploads");
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function readContent() {
  return JSON.parse(fs.readFileSync(CONTENT_PATH, "utf8"));
}
function writeContent(data) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2), "utf8");
}
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function uniqueId(base, existingIds) {
  let id = slugify(base) || "item";
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${slugify(base)}-${n}`;
    n++;
  }
  return id;
}
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(ROOT, decodeURIComponent(filePath));

  // Prevent path traversal outside the site root.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // ---------------- API ----------------
    if (pathname === "/api/data" && req.method === "GET") {
      return sendJSON(res, 200, readContent());
    }

    if (pathname === "/api/site" && req.method === "PUT") {
      const body = await readBody(req);
      const data = readContent();
      data.site = { ...data.site, ...body };
      writeContent(data);
      return sendJSON(res, 200, data.site);
    }

    if (pathname === "/api/projects" && req.method === "POST") {
      const body = await readBody(req);
      const data = readContent();
      const id = uniqueId(body.title || "project", data.projects.map((p) => p.id));
      const project = {
        id,
        title: body.title || "Untitled project",
        path: `~/projects/${id}`,
        year: body.year || String(new Date().getFullYear()),
        tagline: body.tagline || "",
        summary: body.summary || "",
        description: Array.isArray(body.description) ? body.description : String(body.description || "").split("\n\n").filter(Boolean),
        stack: Array.isArray(body.stack) ? body.stack : String(body.stack || "").split(",").map((s) => s.trim()).filter(Boolean),
        featured: !!body.featured,
        images: Array.isArray(body.images) ? body.images : [],
        links: { github: (body.links && body.links.github) || "", live: (body.links && body.links.live) || "" },
      };
      data.projects.push(project);
      writeContent(data);
      return sendJSON(res, 201, project);
    }

    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && (req.method === "PUT" || req.method === "DELETE")) {
      const id = decodeURIComponent(projectMatch[1]);
      const data = readContent();
      const idx = data.projects.findIndex((p) => p.id === id);
      if (idx === -1) return sendJSON(res, 404, { error: "Project not found" });

      if (req.method === "DELETE") {
        const removed = data.projects.splice(idx, 1)[0];
        writeContent(data);
        return sendJSON(res, 200, removed);
      }

      const body = await readBody(req);
      const existing = data.projects[idx];
      const updated = {
        ...existing,
        title: body.title ?? existing.title,
        year: body.year ?? existing.year,
        tagline: body.tagline ?? existing.tagline,
        summary: body.summary ?? existing.summary,
        description: body.description !== undefined
          ? (Array.isArray(body.description) ? body.description : String(body.description).split("\n\n").filter(Boolean))
          : existing.description,
        stack: body.stack !== undefined
          ? (Array.isArray(body.stack) ? body.stack : String(body.stack).split(",").map((s) => s.trim()).filter(Boolean))
          : existing.stack,
        featured: body.featured !== undefined ? !!body.featured : existing.featured,
        images: Array.isArray(body.images) ? body.images : existing.images,
        links: body.links ? { ...existing.links, ...body.links } : existing.links,
      };
      data.projects[idx] = updated;
      writeContent(data);
      return sendJSON(res, 200, updated);
    }

    if (pathname === "/api/experience" && req.method === "POST") {
      const body = await readBody(req);
      const data = readContent();
      const id = uniqueId(`exp-${body.org || "role"}-${body.year || ""}`, data.experience.map((e) => e.id));
      const entry = {
        id,
        year: body.year || "",
        org: body.org || "",
        role: body.role || "",
        description: body.description || "",
      };
      data.experience.unshift(entry);
      writeContent(data);
      return sendJSON(res, 201, entry);
    }

    const expMatch = pathname.match(/^\/api\/experience\/([^/]+)$/);
    if (expMatch && (req.method === "PUT" || req.method === "DELETE")) {
      const id = decodeURIComponent(expMatch[1]);
      const data = readContent();
      const idx = data.experience.findIndex((e) => e.id === id);
      if (idx === -1) return sendJSON(res, 404, { error: "Experience entry not found" });

      if (req.method === "DELETE") {
        const removed = data.experience.splice(idx, 1)[0];
        writeContent(data);
        return sendJSON(res, 200, removed);
      }

      const body = await readBody(req);
      const existing = data.experience[idx];
      const updated = { ...existing, ...body, id: existing.id };
      data.experience[idx] = updated;
      writeContent(data);
      return sendJSON(res, 200, updated);
    }

    if (pathname === "/api/upload" && req.method === "POST") {
      const body = await readBody(req); // { filename, dataUrl }
      const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(body.dataUrl || "");
      if (!match) return sendJSON(res, 400, { error: "Invalid image data" });
      const mime = match[1];
      const buffer = Buffer.from(match[2], "base64");
      const extFromMime = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg" }[mime] || ".png";
      const safeName = slugify((body.filename || "image").replace(/\.[a-zA-Z0-9]+$/, "")) || "image";
      const filename = `${Date.now()}-${safeName}${extFromMime}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      return sendJSON(res, 201, { path: `assets/uploads/${filename}` });
    }

    // ---------------- Static files ----------------
    if (req.method === "GET") {
      return serveStatic(req, res, pathname);
    }

    sendJSON(res, 404, { error: "Not found" });
  } catch (err) {
    sendJSON(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`\nPortfolio site running:`);
  console.log(`  Site:  http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin.html\n`);
});
