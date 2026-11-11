const LIBRARY_NAME = "SRM AP Library";

async function api(path, data) {
  const options = { credentials: "same-origin" };
  if (data) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    options.body = new URLSearchParams(data);
  }
  let response;
  try {
    response = await fetch(path, options);
  } catch (networkError) {
    throw new Error("Cannot reach the server. Is JavaApp running in the terminal?");
  }
  if (response.status === 401) {
    window.location.href = "login.html";
    throw new Error("Please log in first.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The server answered with error " + response.status + ".");
  return body;
}

async function apiOrToast(path, data) {
  try {
    return await api(path, data);
  } catch (error) {
    toast(error.message, true);
    return null;
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function param(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function todayString(extraDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + extraDays);
  return formatDate(d);
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

function textMatches(q, values) {
  return !q || values.join(" ").toLowerCase().includes(q);
}

function markInvalid(form, badInputs) {
  for (const input of form.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
  for (const input of badInputs) input.setAttribute("aria-invalid", "true");
  if (badInputs.length > 0) badInputs[0].focus();
  return badInputs.length > 0;
}

const ICONS = {
  library: '<path d="M4 4v16M8 4v16M12 4v16M15.5 4.5l5 15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lending: '<path d="M12 21v-8M12 13 5 4M12 13l7-9"/><circle cx="5" cy="4" r="1.2"/><circle cx="19" cy="4" r="1.2"/>',
  checkouts: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4"/>',
  patrons: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.7-1.6-5-4-5.7"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  sort: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  barcode: '<path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M17 6v12M20 6v12"/>',
  book: '<path d="M3 6c2.5-1.5 6-1.5 9 1 3-2.5 6.5-2.5 9-1v12c-2.5-1.5-6-1.5-9 1-3-2.5-6.5-2.5-9-1z"/><path d="M12 7v12"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

function icon(name, extraClass = "") {
  return '<svg class="icon ' + extraClass + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
}

const COVER_COLOURS = ["#1f3a5f", "#7a1f2b", "#2e4d3a", "#5a3768", "#a2511d", "#0e5a62",
                       "#3a3a3d", "#7d6418", "#9b3434", "#24505e", "#4a3b2a", "#6b2048"];
const AVATAR_COLOURS = ["#17808f", "#7a4fa3", "#b0532a", "#2f6d4a", "#a33b5b", "#3d5f9a"];

function hashText(text) {
  let h = 0;
  for (const ch of String(text)) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

function coverHtml(book, size = "md") {
  const h = hashText(book.title + "|" + book.author);
  const colour = COVER_COLOURS[h % COVER_COLOURS.length];
  const style = (h >> 4) % 3;
  let flag = "";
  if (book.copies !== undefined && book.out_count !== undefined) {
    const free = book.copies - book.out_count;
    flag = '<span class="cover-flag ' + (free > 0 ? "is-free" : "is-out") + '"></span>';
  }
  if (book.cover) {
    return '<div class="cover cover-' + size + ' cover-img" style="--cover:' + colour + '" aria-hidden="true">' +
      '<img src="' + esc(book.cover) + '" alt="" loading="lazy">' + flag + "</div>";
  }
  return '<div class="cover cover-' + size + " cover-s" + style + '" style="--cover:' + colour + '" aria-hidden="true">' +
    flag + '<span class="cover-title">' + esc(book.title) + '</span><span class="cover-author">' + esc(book.author) + "</span></div>";
}

function avatarHtml(first, last, big = false) {
  const colour = AVATAR_COLOURS[hashText(first + " " + last) % AVATAR_COLOURS.length];
  const letters = ((first || "?").charAt(0) + (last || "").charAt(0)).toUpperCase();
  return '<span class="avatar' + (big ? " avatar-lg" : "") + '" style="--av:' + colour + '" aria-hidden="true">' + esc(letters) + "</span>";
}

function renderSidebar(active) {
  const groups = [
    [{ id: "library", label: "Library", href: "library.html", icon: "library" },
      { id: "add", label: "Add Items", href: "add-book.html", icon: "plus" }],
    [{ id: "lending", label: "Lending", href: "lending.html#lending", icon: "lending" },
      { id: "checkouts", label: "Checkouts", href: "lending.html#checkouts", icon: "checkouts" },
      { id: "patrons", label: "Patrons", href: "lending.html#patrons", icon: "patrons" }]
  ];
  let html = '<a class="brand" href="library.html" aria-label="Libris home"><span class="brand-word">Libris</span>' +
    icon("book") + '</a><nav aria-label="Main">';
  for (const group of groups) {
    html += '<ul class="nav-group">';
    for (const item of group) {
      const current = item.id === active ? ' aria-current="page"' : "";
      html += '<li><a class="nav-link" href="' + item.href + '" data-nav="' + item.id + '"' + current + ">" +
        icon(item.icon) + "<span>" + item.label + "</span></a></li>";
    }
    html += "</ul>";
  }
  html += '<ul class="nav-group"><li><button class="nav-link" type="button" id="logout-btn">' +
    icon("logout") + "<span>Logout</span></button></li></ul></nav>";
  document.getElementById("sidebar").innerHTML = html;
  document.getElementById("logout-btn").addEventListener("click", logout);
  requireLogin();
}

async function requireLogin() {
  try {
    const reply = await api("/api/login");
    if (!reply.loggedIn) window.location.href = "login.html";
  } catch (error) {  }
}

function setActiveNav(active) {
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function libraryChipHtml() {
  return '<div class="library-chip"><span>' + esc(LIBRARY_NAME) + "</span>" + avatarHtml("S", "A") + "</div>";
}

async function logout() {
  try {
    await api("/api/login", { action: "logout" });
  } finally {
    window.location.href = "login.html";
  }
}

function selectTab(tabs, chosen) {
  for (const tab of tabs) {
    const on = tab === chosen;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
  }
}

function onTabArrows(tabs, go) {
  tabs.forEach((tab, i) => {
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") go(tabs[(i + 1) % tabs.length]);
      if (event.key === "ArrowLeft") go(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
}

function toast(message, isError = false) {
  if (!document.getElementById("toasts")) {
    document.body.insertAdjacentHTML("beforeend", '<div id="toasts" class="toasts" role="status" aria-live="polite"></div>');
  }
  const item = document.createElement("div");
  item.className = "toast" + (isError ? " is-error" : "");
  item.textContent = message;
  document.getElementById("toasts").appendChild(item);
  setTimeout(() => item.remove(), isError ? 6000 : 3500);
}

function debounce(fn, wait = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
