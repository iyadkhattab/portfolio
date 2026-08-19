(function () {
  "use strict";

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.setAttribute("data-theme", stored || (prefersDark ? "dark" : "light"));

  function toggleTheme() {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", toggleTheme)
  );

  /* ---------- Nav scroll state + mobile menu ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = document.querySelector(".nav-burger");
  const mobileMenu = document.querySelector(".mobile-menu");
  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      burger.classList.toggle("open");
      mobileMenu.classList.toggle("open");
    });
    mobileMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        burger.classList.remove("open");
        mobileMenu.classList.remove("open");
      })
    );
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  const ICONS = window.ICONS || {};

  function initials(title) {
    return title.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  /* ---------- Fetch live content ---------- */
  async function fetchContent() {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("bad response");
      return await res.json();
    } catch (err) {
      document.querySelectorAll("[data-needs-server]").forEach((el) => (el.style.display = "block"));
      console.error("Could not load content from the local server. Is `node server.js` running?", err);
      return null;
    }
  }

  /* ---------- Render: site info ---------- */
  function renderSite(site) {
    document.querySelectorAll("[data-site-role]").forEach((el) => (el.textContent = site.role));
    document.querySelectorAll("[data-site-intro]").forEach((el) => (el.textContent = site.intro));
    document.querySelectorAll("[data-gh]").forEach((a) => (a.href = site.github));
    document.querySelectorAll("[data-li]").forEach((a) => (a.href = site.linkedin));
    document.querySelectorAll("[data-mail]").forEach((a) => (a.href = "mailto:" + site.email));
    document.querySelectorAll("[data-cv]").forEach((a) => {
      a.href = "/assets/uploads/CV.pdf";
      a.setAttribute("download", "CV.pdf");
    });
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  /* ---------- Render: skills ---------- */
  function renderSkills(skills) {
    const mount = document.querySelector("[data-skills]");
    if (!mount) return;
    mount.innerHTML = skills
      .map(
        (g) => `
      <div class="skill-group reveal">
        <div class="group-name">${g.group}</div>
        <div class="skill-items">${g.items.map((i) => `<span>${i}</span>`).join("")}</div>
      </div>`
      )
      .join("");
  }

  /* ---------- Render: experience ---------- */
  function renderExperience(experience) {
    const mount = document.querySelector("[data-experience]");
    if (!mount) return;
    mount.innerHTML = experience
      .map(
        (e) => `
      <div class="timeline-item reveal">
        <div class="timeline-year mono">${e.year}</div>
        <div class="timeline-rail"><div class="timeline-dot"></div></div>
        <div class="timeline-content">
          <h4>${e.org}</h4>
          <div class="role mono">${e.role}</div>
          <p>${e.description}</p>
        </div>
      </div>`
      )
      .join("");
  }

  /* ---------- Render: projects (editorial rhythm) ---------- */
  function projectCard(p) {
    const img = p.images && p.images[0]
      ? `<img src="${p.images[0]}" alt="${p.title} screenshot" loading="lazy">`
      : `<div class="project-placeholder"><span class="mono-mark">${initials(p.title)}</span></div>`;
    return `
    <a class="project-card reveal" href="project.html?id=${encodeURIComponent(p.id)}">
      <div class="project-media">${img}</div>
      <div class="project-body">
        <div class="project-top">
          <span class="project-path mono">${p.path}</span>
          <span class="project-year">${p.year}</span>
        </div>
        <h3>${p.title}</h3>
        <p class="tagline">${p.tagline}</p>
        <div class="project-stack">${p.stack.slice(0, 4).map((s) => `<span>${s}</span>`).join("")}</div>
        <span class="project-link">View project ${ICONS.arrow || ""}</span>
      </div>
    </a>`;
  }

  function renderProjects(projects) {
    const mount = document.querySelector("[data-projects]");
    if (!mount) return;

    const featured = projects.filter((p) => p.featured);
    const rest = projects.filter((p) => !p.featured);

    let html = "";
    featured.forEach((p) => {
      html += `<div class="project-row single">${projectCard(p)}</div>`;
    });

    for (let i = 0; i < rest.length; i += 2) {
      const pair = rest.slice(i, i + 2);
      if (pair.length === 2) {
        html += `<div class="project-row pair">${pair.map((p) => projectCard(p)).join("")}</div>`;
      } else {
        html += `<div class="project-row single">${projectCard(pair[0])}</div>`;
      }
    }

    mount.innerHTML = html || `<p style="color:var(--text-2)">No projects yet — add one from the <a href="admin.html" style="color:var(--accent)">admin panel</a>.</p>`;
  }

  /* ---------- Render: project detail page ---------- */
  function renderProjectDetail(content) {
    const mount = document.querySelector("[data-project-detail]");
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const project = content.projects.find((p) => p.id === id) || content.projects[0];
    if (!project) {
      mount.innerHTML = `<div class="wrap" style="padding:80px 0"><p>No projects yet. Add one from the <a href="admin.html" style="color:var(--accent)">admin panel</a>.</p></div>`;
      return;
    }

    document.title = `${project.title} — ${content.site.name}`;

    const cover = project.images && project.images[0]
      ? `<img src="${project.images[0]}" alt="${project.title} cover" style="width:100%;height:100%;object-fit:cover">`
      : `<div class="project-placeholder" style="position:static;height:100%"><span class="mono-mark">${initials(project.title)}</span></div>`;

    const backBtn = mount.querySelector("[data-pd-back]");
    if (backBtn) backBtn.innerHTML = `${(ICONS.arrow || "").replace('d="M3 8h10M9 4l4 4-4 4"', 'd="M13 8H3M7 4 3 8l4 4"')} All projects`;
    mount.querySelector("[data-pd-title]").textContent = project.title;
    mount.querySelector("[data-pd-tagline]").textContent = project.tagline;
    mount.querySelector("[data-pd-year]").textContent = project.year;
    mount.querySelector("[data-pd-path]").textContent = project.path;
    mount.querySelector("[data-pd-stack]").innerHTML = project.stack.map((s) => `<span>${s}</span>`).join("");
    mount.querySelector("[data-pd-cover]").innerHTML = cover;

    const linksMount = mount.querySelector("[data-pd-links]");
    let linksHtml = "";
    if (project.links.github) linksHtml += `<a class="btn btn-ghost" href="${project.links.github}">${ICONS.github || ""} Source</a>`;
    if (project.links.live) linksHtml += `<a class="btn btn-primary" href="${project.links.live}">Live project ${ICONS.arrow || ""}</a>`;
    linksMount.innerHTML = linksHtml;

    mount.querySelector("[data-pd-overview]").innerHTML = project.description.map((para) => `<p>${para}</p>`).join("");

    renderGallery(project);
    renderRelated(content.projects, project);
  }

  function renderGallery(project) {
    const mount = document.querySelector("[data-pd-gallery]");
    if (!mount) return;
    const images = project.images && project.images.length > 1 ? project.images.slice(1) : [];

    if (!images.length) {
      mount.innerHTML = `
        <div class="gallery-row one">
          <div class="gallery-item" style="cursor:default">
            <div class="project-placeholder" style="position:static;height:100%">
              <span class="mono-mark" style="font-size:16px;opacity:0.7;max-width:70%;text-align:center;line-height:1.5">Add more screenshots from the admin panel to fill this gallery</span>
            </div>
          </div>
        </div>`;
      return;
    }

    let html = "";
    let i = 0;
    let big = true;
    while (i < images.length) {
      if (big || images.length - i === 1) {
        html += `<div class="gallery-row one"><div class="gallery-item" data-lightbox="${images[i]}"><img src="${images[i]}" alt="${project.title} screenshot" loading="lazy"></div></div>`;
        i += 1;
      } else {
        const two = images.slice(i, i + 2);
        html += `<div class="gallery-row two">${two.map((src) => `<div class="gallery-item" data-lightbox="${src}"><img src="${src}" alt="${project.title} screenshot" loading="lazy"></div>`).join("")}</div>`;
        i += 2;
      }
      big = !big;
    }
    mount.innerHTML = html;

    mount.querySelectorAll("[data-lightbox]").forEach((el) => {
      el.addEventListener("click", () => openLightbox(el.getAttribute("data-lightbox")));
    });
  }

  function renderRelated(allProjects, current) {
    const mount = document.querySelector("[data-pd-related]");
    if (!mount) return;
    const others = allProjects.filter((p) => p.id !== current.id).slice(0, 3);
    mount.innerHTML = others.map((p) => `<div class="project-row single">${projectCard(p)}</div>`).join("");
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(src) {
    const lb = document.querySelector(".lightbox");
    if (!lb) return;
    lb.querySelector("img").src = src;
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    const lb = document.querySelector(".lightbox");
    if (!lb) return;
    lb.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* ---------- Hero console type effect ---------- */
  function typeConsole() {
    const el = document.querySelector("[data-typed]");
    if (!el) return;
    const text = el.getAttribute("data-typed");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = text;
      return;
    }
    let i = 0;
    el.textContent = "";
    const caret = document.createElement("span");
    caret.className = "caret";
    function step() {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        el.appendChild(caret);
        i++;
        setTimeout(step, 28 + Math.random() * 35);
      }
    }
    step();
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = ICONS[el.getAttribute("data-icon")] || "";
    });

    const lb = document.querySelector(".lightbox");
    if (lb) {
      lb.addEventListener("click", (e) => {
        if (e.target === lb || e.target.closest(".lightbox-close")) closeLightbox();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLightbox();
      });
    }

    const content = await fetchContent();
    if (!content) return;

    renderSite(content.site);
    renderSkills(content.skills);
    renderExperience(content.experience);
    renderProjects(content.projects);
    renderProjectDetail(content);

    typeConsole();
    initReveal();
  });
})();
