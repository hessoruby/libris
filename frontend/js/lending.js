renderSidebar("lending");
document.getElementById("chip").innerHTML = libraryChipHtml();

const TABS = { lending: "Lending", checkouts: "Checkouts", patrons: "Patrons" };

const lend = { items: [], patron: null, patronLoans: [], checkInMode: false };
const checkouts = { loans: [], sortBy: "due_date", ascending: true, page: 1, pageSize: 10 };
const patrons = { list: [], editingId: null };

const tabButtons = Object.keys(TABS).map((key) => document.getElementById("tab-" + key));

function currentTab() {
  const name = window.location.hash.slice(1);
  return TABS[name] ? name : "lending";
}

function showTab(name) {
  selectTab(tabButtons, document.getElementById("tab-" + name));
  document.getElementById("page-title").textContent = TABS[name];
  document.title = TABS[name] + " · Libris";
  setActiveNav(name);
  if (name === "checkouts") loadCheckouts();
  if (name === "patrons") loadPatrons();
}

function goToTab(tab) {
  window.location.hash = tab.id.replace("tab-", "");
}
for (const tab of tabButtons) tab.addEventListener("click", () => goToTab(tab));
onTabArrows(tabButtons, (tab) => {
  goToTab(tab);
  tab.focus();
});
window.addEventListener("hashchange", () => showTab(currentTab()));

function setupSearch(input, results, search, row, pick) {
  let found = [];
  const run = debounce(async () => {
    const text = input.value.trim();
    if (!text) {
      results.hidden = true;
      return;
    }
    try {
      found = await search(text);
      if (found.length === 0) {
        results.innerHTML = '<li class="r-empty">Nothing matches "' + esc(text) + '".</li>';
      } else {
        results.innerHTML = found.map((thing, i) => {
          const line = row(thing);
          return '<li><button type="button" data-index="' + i + '"' + (line.disabled ? " disabled" : "") + ">" + line.html + "</button></li>";
        }).join("");
      }
    } catch (error) {
      results.innerHTML = '<li class="r-empty">' + esc(error.message) + "</li>";
    }
    results.hidden = false;
  }, 180);
  input.addEventListener("input", run);
  input.addEventListener("focus", () => {
    if (input.value.trim()) run();
  });
  input.addEventListener("keydown", (event) => {
    const first = results.querySelector("button:not(:disabled)");
    if (event.key === "ArrowDown" && first && !results.hidden) {
      event.preventDefault();
      first.focus();
    }
    if (event.key === "Escape") results.hidden = true;
  });
  results.addEventListener("keydown", (event) => {
    const buttons = Array.from(results.querySelectorAll("button:not(:disabled)"));
    const i = buttons.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[Math.min(i + 1, buttons.length - 1)].focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (i <= 0) input.focus();
      else buttons[i - 1].focus();
    }
    if (event.key === "Escape") {
      results.hidden = true;
      input.focus();
    }
  });
  results.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    pick(found[Number(button.dataset.index)]);
    input.value = "";
    results.hidden = true;
    input.focus();
  });
  document.addEventListener("click", (event) => {
    if (!input.closest(".search-box").contains(event.target)) results.hidden = true;
  });
}

function resultHtml(picture, title, subParts, note) {
  return picture + '<span><span class="r-title">' + esc(title) + '</span><br><span class="r-sub">' +
    subParts.map((part) => esc(part)).join(" · ") + '</span></span><span class="r-note">' + note + "</span>";
}

function clickedThing(event, attribute, list) {
  const button = event.target.closest("[data-" + attribute + "]");
  if (!button) return undefined;
  return list.find((thing) => thing.id === Number(button.dataset[attribute]));
}

const issueInput = document.getElementById("issue-date");
const dueInput = document.getElementById("due-date");
const checkoutButton = document.getElementById("checkout-btn");
const modeButton = document.getElementById("mode-btn");
const itemList = document.getElementById("lend-items");
const itemSearch = document.getElementById("item-search");

issueInput.value = todayString();
issueInput.max = todayString();
dueInput.value = todayString(14);

issueInput.addEventListener("change", () => {
  if (!issueInput.value) return;
  const due = new Date(issueInput.value + "T00:00:00");
  due.setDate(due.getDate() + 14);
  dueInput.value = formatDate(due);
});

setupSearch(itemSearch, document.getElementById("item-results"),
  async (text) => {
    if (lend.checkInMode) {
      const reply = await api("/api/loans?status=active&q=" + encodeURIComponent(text));
      return reply.loans.slice(0, 8);
    }
    const reply = await api("/api/books?q=" + encodeURIComponent(text));
    return reply.books.slice(0, 8);
  },
  (thing) => {
    if (lend.checkInMode) {
      const who = "with " + thing.first_name + " " + thing.last_name;
      const note = thing.status === "overdue" ? "Overdue" : "Due " + esc(thing.due_date);
      return { html: resultHtml(coverHtml(thing, "sm"), thing.title, [who, thing.code], note) };
    }
    const free = thing.copies - thing.out_count;
    const added = lend.items.some((b) => b.id === thing.id);
    let note = "None free";
    if (added) note = "Added";
    else if (free > 0) note = free + " free";
    return { disabled: free <= 0 || added, html: resultHtml(coverHtml(thing, "sm"), thing.title, [thing.author, thing.code], note) };
  },
  (thing) => {
    if (lend.checkInMode) {
      checkIn(thing);
    } else {
      lend.items.push(thing);
      renderItems();
    }
  }
);

setupSearch(document.getElementById("patron-search"), document.getElementById("patron-results"),
  async (text) => {
    const reply = await api("/api/members?q=" + encodeURIComponent(text));
    return reply.members.slice(0, 8);
  },
  (member) => {
    const name = member.first_name + " " + member.last_name;
    const note = plural(member.out_count, "book") + " out";
    return { html: resultHtml(avatarHtml(member.first_name, member.last_name), name, [member.card, member.ap_number], note) };
  },
  (member) => {
    lend.patron = member;
    loadPatronLoans();
  }
);

async function loadPatronLoans() {
  if (lend.patron) {
    const reply = await apiOrToast("/api/loans?status=active&member_id=" + lend.patron.id);
    if (reply) lend.patronLoans = reply.loans;
  } else {
    lend.patronLoans = [];
  }
  renderPatron();
  renderItems();
}

function renderPatron() {
  const box = document.getElementById("patron-box");
  const p = lend.patron;
  updateCheckoutButton();
  if (!p) {
    box.innerHTML = '<div class="patron-hint">Choose who is borrowing. Search by card number, name, AP number or email.</div>';
    return;
  }
  const overdue = lend.patronLoans.filter((loan) => loan.status === "overdue").length;
  box.innerHTML = '<div class="patron-card">' + avatarHtml(p.first_name, p.last_name, true) +
    '<div class="who"><b>' + esc(p.first_name + " " + p.last_name) + '</b><span class="muted">' + esc(p.ap_number) + "</span>" +
      (p.email ? '<span class="muted">' + esc(p.email) + "</span>" : "") +
      '<span class="code">' + icon("barcode") + esc(p.card) + "</span>" +
      '<span class="stat">Has ' + plural(lend.patronLoans.length, "book") + " right now</span>" +
      (overdue ? '<span class="stat is-overdue">' + plural(overdue, "book") + " overdue</span>" : "") +
    '</div><div class="actions"><button class="btn btn-small" type="button" id="patron-edit">' + icon("edit") + "Edit</button>" +
      '<button class="icon-btn" type="button" id="patron-clear" aria-label="Remove patron">' + icon("close") + "</button></div></div>";
  document.getElementById("patron-clear").addEventListener("click", () => {
    lend.patron = null;
    loadPatronLoans();
  });
  document.getElementById("patron-edit").addEventListener("click", () => {
    window.location.hash = "patrons";
    startEditPatron(p);
  });
}

function lendItemHtml(book, top, bottom, button) {
  return '<li class="lend-item">' + coverHtml(book, "md") + '<div class="info">' + top +
    '<span class="t">' + esc(book.title) + '</span><span class="a">' + esc(book.author) + "</span>" +
    '<span class="code">' + icon("barcode") + esc(book.code) + "</span>" + bottom + "</div>" + button + "</li>";
}

function renderItems() {
  if (lend.checkInMode && !lend.patron) {
    itemList.innerHTML = '<li class="lend-empty">Search for a borrowed book above, or choose a patron to see their books.</li>';
  } else if (lend.checkInMode && lend.patronLoans.length === 0) {
    itemList.innerHTML = '<li class="lend-empty">' + esc(lend.patron.first_name) + " has no books to return.</li>";
  } else if (lend.checkInMode) {
    itemList.innerHTML = lend.patronLoans.map((loan) => {
      const overdue = loan.status === "overdue";
      const late = overdue ? " · " + plural(loan.days_overdue, "day") + " overdue" : "";
      const when = '<span class="when' + (overdue ? " is-overdue" : "") + '">Due ' + esc(loan.due_date) + late + "</span>";
      return lendItemHtml(loan, "", when, '<button class="btn btn-primary btn-small" type="button" data-checkin="' + loan.id + '">Check In</button>');
    }).join("");
  } else if (lend.items.length === 0) {
    itemList.innerHTML = '<li class="lend-empty">Search for a book above to add it here.</li>';
  } else {
    itemList.innerHTML = lend.items.map((book) => {
      const crumb = '<span class="crumb-sm">' + icon("library") + "My Books</span>";
      const remove = '<button class="icon-btn" type="button" data-remove="' + book.id + '" aria-label="Remove ' +
        esc(book.title) + '">' + icon("close") + "</button>";
      return lendItemHtml(book, crumb, "", remove);
    }).join("");
  }
  updateCheckoutButton();
}

itemList.addEventListener("click", (event) => {
  const book = clickedThing(event, "remove", lend.items);
  if (book) {
    lend.items = lend.items.filter((b) => b.id !== book.id);
    renderItems();
    itemSearch.focus();
  }
  const loan = clickedThing(event, "checkin", lend.patronLoans);
  if (loan) checkIn(loan);
});

function updateCheckoutButton() {
  checkoutButton.hidden = lend.checkInMode;
  checkoutButton.disabled = lend.items.length === 0 || !lend.patron;
  checkoutButton.textContent = lend.items.length > 1 ? "Checkout " + lend.items.length + " books" : "Checkout";
}

checkoutButton.addEventListener("click", async () => {
  const issue = issueInput.value;
  const due = dueInput.value;
  if (!issue || !due) {
    toast("Choose both the Checked Out and Due Date.", true);
    return;
  }
  if (due < issue) {
    toast("Due Date must be on or after the Checked Out date.", true);
    return;
  }
  const MAX_BOOKS = 5;
  const room = MAX_BOOKS - lend.patronLoans.length;
  if (lend.items.length > room) {
    toast(lend.patron.first_name + " has " + plural(lend.patronLoans.length, "book") +
      " and can borrow only " + plural(Math.max(room, 0), "more book") + " (the most is " + MAX_BOOKS + ").", true);
    return;
  }
  checkoutButton.disabled = true;
  const done = [];
  for (const book of lend.items) {
    try {
      await api("/api/loans", { action: "checkout", book_id: book.id, member_id: lend.patron.id, issue_date: issue, due_date: due });
      done.push(book);
    } catch (error) {
      toast('"' + book.title + '": ' + error.message, true);
    }
  }
  lend.items = lend.items.filter((b) => !done.includes(b));
  if (done.length > 0) {
    toast(plural(done.length, "book") + " checked out to " + lend.patron.first_name + ". Due " + due + ".");
  }
  await loadPatronLoans();
});

async function checkIn(loan) {
  const reply = await apiOrToast("/api/loans", { action: "checkin", loan_id: loan.id });
  if (!reply) return;
  if (reply.days_late > 0) toast('"' + loan.title + '" checked in, ' + plural(reply.days_late, "day") + " late.");
  else toast('"' + loan.title + '" checked in.');
  if (lend.patron) await loadPatronLoans();
  if (currentTab() === "checkouts") loadCheckouts();
}

modeButton.addEventListener("click", () => {
  const on = !lend.checkInMode;
  lend.checkInMode = on;
  modeButton.setAttribute("aria-pressed", String(on));
  modeButton.textContent = on ? "Back to Checkout" : "Check In Mode";
  document.getElementById("item-label").textContent = on ? "Return Item" : "Lending Item";
  itemSearch.placeholder = on ? "Barcode / Title / Patron" : "Barcode / Title";
  document.getElementById("date-row").hidden = on;
  renderItems();
});

async function preselect() {
  const bookId = param("book");
  const memberId = param("member");
  try {
    if (bookId) {
      const reply = await api("/api/books?id=" + encodeURIComponent(bookId));
      const book = reply.book;
      if (book.copies - book.out_count > 0) lend.items.push(book);
      else toast('No free copies of "' + book.title + '" are left.', true);
    }
    if (memberId) {
      const reply = await api("/api/members");
      const member = reply.members.find((m) => String(m.id) === memberId);
      if (member) lend.patron = member;
    }
  } catch (error) {
    toast(error.message, true);
  }
  await loadPatronLoans();
}

const COLUMNS = [
  { key: "title", label: "Item" }, { key: "first_name", label: "First" }, { key: "last_name", label: "Last" },
  { key: "card", label: "Card" }, { key: "issue_date", label: "Checked Out" }, { key: "due_date", label: "Due Date" },
  { key: null, label: "Barcode" }
];

async function loadCheckouts() {
  const reply = await apiOrToast("/api/loans?status=" + document.getElementById("status-filter").value);
  checkouts.loans = reply ? reply.loans : [];
  renderCheckouts();
}

function renderCheckouts() {
  const q = document.getElementById("checkout-search").value.trim().toLowerCase();
  const key = checkouts.sortBy;
  const matching = checkouts.loans.filter((l) => textMatches(q, [l.title, l.author, l.first_name, l.last_name, l.code, l.card]));
  matching.sort((a, b) => {
    const result = String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { sensitivity: "base" });
    return checkouts.ascending ? result : -result;
  });
  const total = matching.length;
  const pages = Math.max(1, Math.ceil(total / checkouts.pageSize));
  checkouts.page = Math.min(checkouts.page, pages);
  const start = (checkouts.page - 1) * checkouts.pageSize;
  const rows = matching.slice(start, start + checkouts.pageSize);
  document.querySelector("#checkouts-table thead").innerHTML = "<tr>" + COLUMNS.map((col) => headerCellHtml(col)).join("") + "</tr>";
  const body = document.querySelector("#checkouts-table tbody");
  if (rows.length > 0) {
    body.innerHTML = rows.map((loan) => checkoutRow(loan, key)).join("");
  } else {
    let why = "No checkouts to show.";
    if (q) why = "No checkouts match your search.";
    else if (document.getElementById("status-filter").value === "overdue") why = "Nothing is overdue. Good.";
    body.innerHTML = '<tr><td colspan="7"><div class="empty">' + why + "</div></td></tr>";
  }
  const showing = document.getElementById("showing");
  if (total === 0) showing.textContent = "Showing 0 entries";
  else showing.textContent = "Showing " + (start + 1) + " to " + (start + rows.length) + " of " + total + " entries";
  let pager = '<button type="button" data-page="' + (checkouts.page - 1) + '"' + (checkouts.page === 1 ? " disabled" : "") + ">Previous</button>";
  for (let n = 1; n <= pages; n++) {
    pager += '<button type="button" data-page="' + n + '"' + (n === checkouts.page ? ' aria-current="page"' : "") + ">" + n + "</button>";
  }
  pager += '<button type="button" data-page="' + (checkouts.page + 1) + '"' + (checkouts.page === pages ? " disabled" : "") + ">Next</button>";
  document.getElementById("pager").innerHTML = pager;
}

function headerCellHtml(col) {
  if (!col.key) return "<th><span>" + col.label + "</span></th>";
  let ariaSort = "";
  let arrow = "sort";
  if (col.key === checkouts.sortBy) {
    ariaSort = checkouts.ascending ? ' aria-sort="ascending"' : ' aria-sort="descending"';
    arrow = checkouts.ascending ? "arrowUp" : "arrowDown";
  }
  return "<th" + ariaSort + '><button type="button" data-sort="' + col.key + '">' + col.label + icon(arrow) + "</button></th>";
}

function checkoutRow(loan, sortedKey) {
  function cell(colKey, html) {
    return "<td" + (colKey === sortedKey ? ' class="col-sorted"' : "") + ">" + html + "</td>";
  }
  const overdue = loan.status === "overdue";
  let action = '<button class="btn btn-primary btn-small" type="button" data-checkin="' + loan.id + '" style="width: 92px;">Check In</button>';
  if (loan.status === "returned") action = '<span class="muted">Returned <time>' + esc(loan.return_date) + "</time></span>";
  let late = "";
  if (overdue) late = '<span class="sub" style="color: var(--danger); font-weight: 500;">' + plural(loan.days_overdue, "day") + " overdue</span>";
  return '<tr class="' + (overdue ? "is-overdue" : "") + '">' +
    cell("title", '<div class="item-cell">' + coverHtml(loan, "sm") +
      '<div class="stack"><a href="book.html?id=' + loan.book_id + '">' + esc(loan.title) + '</a><span class="sub">' + esc(loan.author) + "</span>" +
      (loan.shelf ? '<span class="chip">' + esc(loan.shelf) + "</span>" : "") + "</div></div>") +
    cell("first_name", '<span class="strong">' + esc(loan.first_name) + "</span>") +
    cell("last_name", '<span class="strong">' + esc(loan.last_name) + "</span>") +
    cell("card", esc(loan.card)) +
    cell("issue_date", '<span class="date-cell">' + icon("calendar") + "<time>" + esc(loan.issue_date) + "</time></span>") +
    cell("due_date", '<div class="stack"><span class="date-cell">' + icon("calendar") +
      '<time class="due-chip">' + esc(loan.due_date) + "</time></span>" + late + "</div>") +
    cell(null, '<div class="stack">' + action + '<span class="code">' + icon("barcode") + esc(loan.code) + "</span></div>") + "</tr>";
}

document.getElementById("checkouts-table").addEventListener("click", (event) => {
  const sortButton = event.target.closest("[data-sort]");
  if (sortButton) {
    const key = sortButton.dataset.sort;
    if (checkouts.sortBy === key) checkouts.ascending = !checkouts.ascending;
    else checkouts.ascending = true;
    checkouts.sortBy = key;
    renderCheckouts();
    document.querySelector('[data-sort="' + key + '"]').focus();
  }
  const loan = clickedThing(event, "checkin", checkouts.loans);
  if (loan) checkIn(loan);
});

document.getElementById("pager").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  checkouts.page = Number(button.dataset.page);
  renderCheckouts();
});

document.getElementById("status-filter").addEventListener("change", () => {
  checkouts.page = 1;
  loadCheckouts();
});
document.getElementById("checkout-search").addEventListener("input", debounce(() => {
  checkouts.page = 1;
  renderCheckouts();
}, 150));

const patronForm = document.getElementById("patron-form");
const patronMessage = document.getElementById("patron-message");

async function loadPatrons() {
  const reply = await apiOrToast("/api/members");
  patrons.list = reply ? reply.members : [];
  renderPatrons();
}

function renderPatrons() {
  const q = document.getElementById("patron-filter").value.trim().toLowerCase();
  const rows = patrons.list.filter((m) => textMatches(q, [m.first_name, m.last_name, m.ap_number, m.email, m.phone, m.card]));
  document.getElementById("patron-count").textContent = plural(rows.length, "patron");
  const body = document.getElementById("patron-rows");
  if (rows.length > 0) {
    body.innerHTML = rows.map((m) => patronRowHtml(m)).join("");
  } else {
    let why = "No patrons match your search.";
    if (patrons.list.length === 0) why = "<strong>No patrons yet.</strong>Add the first one with the form above.";
    body.innerHTML = '<tr><td colspan="9"><div class="empty">' + why + "</div></td></tr>";
  }
}

function patronRowHtml(m) {
  return '<tr><td><span class="item-cell" style="min-width: 0;">' + avatarHtml(m.first_name, m.last_name) +
      '<span class="strong">' + esc(m.first_name) + "</span></span></td>" +
    '<td><span class="strong">' + esc(m.last_name) + '</span></td><td><span class="code">' + esc(m.ap_number) + "</span></td>" +
    "<td>" + esc(m.email || "—") + "</td><td>" + esc(m.phone || "—") + "</td>" +
    '<td><span class="code">' + icon("barcode") + esc(m.card) + "</span></td>" +
    "<td>" + (m.out_count > 0 ? '<span class="pill pill-ok">' + m.out_count + "</span>" : "0") + "</td>" +
    "<td><time>" + esc(m.joined) + "</time></td>" +
    '<td><div style="display: flex; gap: 4px; justify-content: flex-end;">' +
      '<a class="btn btn-small btn-ghost" href="lending.html?member=' + m.id + '#lending">Lend</a>' +
      '<button class="btn btn-small btn-ghost" type="button" data-edit="' + m.id + '">' + icon("edit") + "Edit</button>" +
      '<button class="btn btn-small btn-ghost btn-danger-text" type="button" data-delete="' + m.id + '">' + icon("trash") + "Delete</button>" +
    "</div></td></tr>";
}

function startEditPatron(member) {
  patrons.editingId = member.id;
  for (const name of ["first_name", "last_name", "ap_number", "email", "phone"]) {
    patronForm.elements[name].value = member[name] ?? "";
  }
  document.getElementById("patron-form-title").textContent = "Edit Patron · " + member.card;
  document.getElementById("patron-save").textContent = "Save Patron";
  document.getElementById("patron-cancel").hidden = false;
  patronMessage.textContent = "";
  patronForm.scrollIntoView({ behavior: "smooth", block: "start" });
  patronForm.elements.first_name.focus();
}

function stopEditPatron() {
  patrons.editingId = null;
  patronForm.reset();
  document.getElementById("patron-form-title").textContent = "Add Patron";
  document.getElementById("patron-save").textContent = "Add Patron";
  document.getElementById("patron-cancel").hidden = true;
  patronMessage.textContent = "";
}

patronForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const required = ["first_name", "last_name", "ap_number"].map((name) => patronForm.elements[name]);
  const missing = required.filter((input) => !input.value.trim());
  if (markInvalid(patronForm, missing)) {
    patronMessage.textContent = "First name, Last name and AP number are required.";
    return;
  }
  const data = Object.fromEntries(new FormData(patronForm));
  data.action = patrons.editingId ? "update" : "add";
  if (patrons.editingId) data.id = patrons.editingId;
  const saveButton = document.getElementById("patron-save");
  saveButton.disabled = true;
  try {
    await api("/api/members", data);
    toast(patrons.editingId ? "Patron saved." : data.first_name + " " + data.last_name + " was added.");
    const editedId = patrons.editingId;
    stopEditPatron();
    await loadPatrons();
    if (lend.patron && lend.patron.id === editedId) {
      lend.patron = patrons.list.find((m) => m.id === editedId) || null;
      loadPatronLoans();
    }
  } catch (error) {
    patronMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("patron-cancel").addEventListener("click", stopEditPatron);
document.getElementById("patron-filter").addEventListener("input", debounce(renderPatrons, 150));

document.getElementById("patron-rows").addEventListener("click", async (event) => {
  const toEdit = clickedThing(event, "edit", patrons.list);
  if (toEdit) startEditPatron(toEdit);
  const member = clickedThing(event, "delete", patrons.list);
  if (!member || !confirm("Delete " + member.first_name + " " + member.last_name + "? This cannot be undone.")) return;
  const reply = await apiOrToast("/api/members", { action: "delete", id: member.id });
  if (!reply) return;
  toast(member.first_name + " " + member.last_name + " was deleted.");
  if (patrons.editingId === member.id) stopEditPatron();
  if (lend.patron && lend.patron.id === member.id) {
    lend.patron = null;
    loadPatronLoans();
  }
  loadPatrons();
});

showTab(currentTab());
preselect();
