(function () {
  "use strict";

  const ICONS = window.ICONS || {};
  let STATE = { site: {}, projects: [], experience: [], skills: [] };

  /* ---------- Theme (reuse same toggle as the main site) ---------- */
  const root = document.documentElement;
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.setAttribute("data-theme", stored || (prefersDark ? "dark" : "light"));
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    })
  );

  /* ---------- Tabs ---------- */
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll("[data-panel]").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`[data-panel="${btn.getAttribute("data-tab")}"]`).classList.add("active");
    });
  });

  /* ---------- Toast ---------- */
  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => (el.className = "toast"), 2600);
  }

  /* ---------- API helpers ---------- */
  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function uploadFile(file) {
    const dataUrl = await fileToDataUrl(file);
    const res = await api("POST", "/api/upload", { filename: file.name, dataUrl });
    return res.path;
  }

  /* ---------- Load ---------- */
  async function load() {
    try {
      STATE = await api("GET", "/api/data");
      renderProjectList();
      renderExperienceList();
    } catch (err) {
      toast("Can't reach the local server — run `node server.js` first.", true);
    }
  }

  /* ================= PROJECTS ================= */
  const projectListEl = document.getElementById("projectList");
  const projectFormPanel = document.getElementById("projectFormPanel");
  const projectForm = document.getElementById("projectForm");
  let editingProjectId = null;
  let pendingImages = []; // { file?, dataUrl, path? } in display order; index 0 = cover

  function renderProjectList() {
    if (!STATE.projects.length) {
      projectListEl.innerHTML = `<p class="empty">No projects yet. Add your first one below.</p>`;
      return;
    }
    projectListEl.innerHTML = STATE.projects
      .map(
        (p) => `
      <div class="item-row">
        <div class="item-thumb">${p.images[0] ? `<img src="${p.images[0]}" alt="">` : `<span class="mono-mark">${p.title.slice(0, 2).toUpperCase()}</span>`}</div>
        <div class="item-info">
          <div class="item-title">${p.title} ${p.featured ? '<span class="pill">Featured</span>' : ""}</div>
          <div class="item-sub mono">${p.path} · ${p.year}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-edit-project="${p.id}" title="Edit">${ICONS.edit}</button>
          <button class="icon-btn danger" data-delete-project="${p.id}" title="Delete">${ICONS.trash}</button>
        </div>
      </div>`
      )
      .join("");

    projectListEl.querySelectorAll("[data-edit-project]").forEach((b) =>
      b.addEventListener("click", () => openProjectForm(b.getAttribute("data-edit-project")))
    );
    projectListEl.querySelectorAll("[data-delete-project]").forEach((b) =>
      b.addEventListener("click", () => deleteProject(b.getAttribute("data-delete-project")))
    );
  }

  function openProjectForm(id) {
    editingProjectId = id || null;
    const p = id ? STATE.projects.find((x) => x.id === id) : null;
    pendingImages = p ? p.images.map((path) => ({ path })) : [];

    projectForm.reset();
    projectForm.title.value = p ? p.title : "";
    projectForm.tagline.value = p ? p.tagline : "";
    projectForm.summary.value = p ? p.summary : "";
    projectForm.description.value = p ? p.description.join("\n\n") : "";
    projectForm.stack.value = p ? p.stack.join(", ") : "";
    projectForm.year.value = p ? p.year : String(new Date().getFullYear());
    projectForm.featured.checked = p ? !!p.featured : false;
    projectForm.github.value = p ? p.links.github || "" : "";
    projectForm.live.value = p ? p.links.live || "" : "";

    document.getElementById("projectFormTitle").textContent = p ? `Edit “${p.title}”` : "Add a project";
    document.getElementById("deleteProjectBtn").style.display = p ? "inline-flex" : "none";
    renderImagePreview();
    projectFormPanel.classList.add("open");
    projectForm.title.focus();
  }

  function closeProjectForm() {
    projectFormPanel.classList.remove("open");
    editingProjectId = null;
    pendingImages = [];
  }

  function renderImagePreview() {
    const mount = document.getElementById("imagePreview");
    mount.innerHTML = pendingImages
      .map(
        (img, i) => `
      <div class="img-thumb">
        <img src="${img.dataUrl || img.path}" alt="">
        ${i === 0 ? '<span class="cover-badge">Cover</span>' : ""}
        <button type="button" class="img-remove" data-remove-img="${i}" aria-label="Remove image">${ICONS.close}</button>
      </div>`
      )
      .join("") + `<label class="img-add"><input type="file" accept="image/*" multiple id="imageInput" hidden>${ICONS.plus}<span>Add images</span></label>`;

    mount.querySelectorAll("[data-remove-img]").forEach((btn) =>
      btn.addEventListener("click", () => {
        pendingImages.splice(Number(btn.getAttribute("data-remove-img")), 1);
        renderImagePreview();
      })
    );
    document.getElementById("imageInput").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        pendingImages.push({ file, dataUrl });
      }
      renderImagePreview();
    });
  }

  document.getElementById("addProjectBtn").addEventListener("click", () => openProjectForm(null));
  document.getElementById("cancelProjectBtn").addEventListener("click", closeProjectForm);
  document.getElementById("deleteProjectBtn").addEventListener("click", () => {
    if (editingProjectId) deleteProject(editingProjectId);
  });

  projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = projectForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    try {
      // Upload any newly-added images that don't have a server path yet.
      const finalImagePaths = [];
      for (const img of pendingImages) {
        if (img.path) {
          finalImagePaths.push(img.path);
        } else {
          const path = await uploadFile(img.file);
          finalImagePaths.push(path);
        }
      }

      const payload = {
        title: projectForm.title.value.trim(),
        tagline: projectForm.tagline.value.trim(),
        summary: projectForm.summary.value.trim(),
        description: projectForm.description.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
        stack: projectForm.stack.value.split(",").map((s) => s.trim()).filter(Boolean),
        year: projectForm.year.value.trim(),
        featured: projectForm.featured.checked,
        images: finalImagePaths,
        links: { github: projectForm.github.value.trim(), live: projectForm.live.value.trim() },
      };

      if (editingProjectId) {
        await api("PUT", `/api/projects/${encodeURIComponent(editingProjectId)}`, payload);
        toast("Project updated.");
      } else {
        await api("POST", "/api/projects", payload);
        toast("Project added.");
      }
      await load();
      closeProjectForm();
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save project";
    }
  });

  async function deleteProject(id) {
    const p = STATE.projects.find((x) => x.id === id);
    if (!confirm(`Delete “${p ? p.title : id}”? This can't be undone.`)) return;
    try {
      await api("DELETE", `/api/projects/${encodeURIComponent(id)}`);
      toast("Project deleted.");
      await load();
      closeProjectForm();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ================= EXPERIENCE ================= */
  const expListEl = document.getElementById("expList");
  const expFormPanel = document.getElementById("expFormPanel");
  const expForm = document.getElementById("expForm");
  let editingExpId = null;

  function renderExperienceList() {
    if (!STATE.experience.length) {
      expListEl.innerHTML = `<p class="empty">No experience entries yet.</p>`;
      return;
    }
    expListEl.innerHTML = STATE.experience
      .map(
        (e) => `
      <div class="item-row">
        <div class="item-thumb mono">${e.year}</div>
        <div class="item-info">
          <div class="item-title">${e.org}</div>
          <div class="item-sub mono">${e.role}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-edit-exp="${e.id}" title="Edit">${ICONS.edit}</button>
          <button class="icon-btn danger" data-delete-exp="${e.id}" title="Delete">${ICONS.trash}</button>
        </div>
      </div>`
      )
      .join("");

    expListEl.querySelectorAll("[data-edit-exp]").forEach((b) =>
      b.addEventListener("click", () => openExpForm(b.getAttribute("data-edit-exp")))
    );
    expListEl.querySelectorAll("[data-delete-exp]").forEach((b) =>
      b.addEventListener("click", () => deleteExp(b.getAttribute("data-delete-exp")))
    );
  }

  function openExpForm(id) {
    editingExpId = id || null;
    const e = id ? STATE.experience.find((x) => x.id === id) : null;
    expForm.reset();
    expForm.year.value = e ? e.year : String(new Date().getFullYear());
    expForm.org.value = e ? e.org : "";
    expForm.role.value = e ? e.role : "";
    expForm.description.value = e ? e.description : "";
    document.getElementById("expFormTitle").textContent = e ? `Edit “${e.org}”` : "Add an experience entry";
    document.getElementById("deleteExpBtn").style.display = e ? "inline-flex" : "none";
    expFormPanel.classList.add("open");
    expForm.org.focus();
  }
  function closeExpForm() {
    expFormPanel.classList.remove("open");
    editingExpId = null;
  }

  document.getElementById("addExpBtn").addEventListener("click", () => openExpForm(null));
  document.getElementById("cancelExpBtn").addEventListener("click", closeExpForm);
  document.getElementById("deleteExpBtn").addEventListener("click", () => {
    if (editingExpId) deleteExp(editingExpId);
  });

  expForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = expForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    try {
      const payload = {
        year: expForm.year.value.trim(),
        org: expForm.org.value.trim(),
        role: expForm.role.value.trim(),
        description: expForm.description.value.trim(),
      };
      if (editingExpId) {
        await api("PUT", `/api/experience/${encodeURIComponent(editingExpId)}`, payload);
        toast("Experience updated.");
      } else {
        await api("POST", "/api/experience", payload);
        toast("Experience added.");
      }
      await load();
      closeExpForm();
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function deleteExp(id) {
    const e = STATE.experience.find((x) => x.id === id);
    if (!confirm(`Delete “${e ? e.org : id}”? This can't be undone.`)) return;
    try {
      await api("DELETE", `/api/experience/${encodeURIComponent(id)}`);
      toast("Experience deleted.");
      await load();
      closeExpForm();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = ICONS[el.getAttribute("data-icon")] || "";
    });
    load();
  });
})();
