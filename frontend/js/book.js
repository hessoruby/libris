renderSidebar("library");

const bookId = param("id");
const detail = document.getElementById("detail");
const toolbar = document.getElementById("toolbar");
const closeLink = '<a class="icon-btn" href="library.html" aria-label="Close and go back to the library">' + icon("close") + "</a>";
toolbar.innerHTML = closeLink;

async function loadBook() {
  if (!bookId) {
    detail.innerHTML = '<div class="empty"><strong>No book was chosen.</strong><a href="library.html">Go to the library</a></div>';
    return;
  }
  try {
    const reply = await api("/api/books?id=" + encodeURIComponent(bookId));
    render(reply.book, reply.history);
  } catch (error) {
    detail.innerHTML = '<div class="empty"><strong>Could not open this book.</strong>' + esc(error.message) +
      '<br><a href="library.html">Back to the library</a></div>';
  }
}

function render(book, history) {
  document.title = book.title + " · Libris";
  const free = book.copies - book.out_count;
  toolbar.innerHTML =
    '<a class="btn btn-ghost" href="add-book.html?id=' + book.id + '">' + icon("edit") + "Edit</a>" +
    '<a class="btn btn-ghost" href="lending.html?book=' + book.id + '#lending">' + icon("send") + "Lend</a>" +
    '<button class="btn btn-ghost btn-danger-text" type="button" id="delete-btn">' + icon("trash") + "Delete</button>" + closeLink;
  const firstLine = [];
  if (book.year) firstLine.push("<b>" + esc(book.year) + "</b>");
  if (book.pages) firstLine.push(esc(book.pages) + " pages");
  if (book.publisher) firstLine.push("(" + esc(book.publisher) + ")");
  let shelfChips = "—";
  if (book.shelf) {
    const chips = book.shelf.split(/[-.\s]+/).map((part) => '<span class="chip">' + esc(part) + "</span>");
    shelfChips = '<span class="shelf-chips">' + chips.join(".") + "</span>";
  }
  const statusPill = free > 0 ? '<span class="pill pill-ok">Available</span>' : '<span class="pill pill-out">All copies out</span>';
  let descriptionHtml = '<p class="muted">No description yet. Use Edit to add one.</p>';
  if (book.description) descriptionHtml = "<p>" + esc(book.description) + "</p>";
  let notesHtml = '<p class="muted">No notes for this book.</p>';
  if (book.notes) notesHtml = "<p>" + esc(book.notes) + "</p>";
  detail.innerHTML =
    '<div class="detail"><div class="detail-side">' + coverHtml(book, "lg") + statusPill + "</div><div>" +
      '<div class="crumb">' + icon("library") + 'My Books <span class="chip">Book</span></div>' +
      "<h1>" + esc(book.title) + "</h1>" +
      '<p class="byline">' + esc(book.author) + "</p>" +
      '<div class="facts">' +
        (firstLine.length ? '<div class="row">' + firstLine.join(" ") + "</div>" : "") +
        '<div class="row">' + (book.isbn ? "<span><b>ISBN:</b> " + esc(book.isbn) + "</span>" : "") +
          '<span class="code"><b>Code:</b> ' + icon("barcode") + esc(book.code) + "</span></div>" +
        '<div class="row"><span><b>Shelf:</b> ' + shelfChips + "</span></div>" +
        '<div class="row"><span><b>Added:</b> <time>' + esc(book.added) + "</time></span></div>" +
        '<div class="counts">' + icon("lending") + "<span><b>Copies</b> " + book.copies + "</span>" +
          "<span><b>Out</b> " + book.out_count + "</span><span><b>Free</b> " + free + "</span></div>" +
      "</div>" +
      (book.category ? '<span class="tag">' + esc(book.category) + "</span>" : "") +
      '<div class="tabs" role="tablist" aria-label="Book information">' +
        tabButton("description", "Description", true) +
        tabButton("notes", "Notes", false) +
        tabButton("history", "History (" + history.length + ")", false) +
      "</div>" +
      tabPanel("description", true, descriptionHtml) +
      tabPanel("notes", false, notesHtml) +
      tabPanel("history", false, historyHtml(history)) +
    "</div></div>";
  document.getElementById("delete-btn").addEventListener("click", () => deleteBook(book));
  setupTabs();
}

function tabButton(id, label, selected) {
  return '<button class="tab" type="button" role="tab" id="tab-' + id + '" aria-controls="panel-' + id + '"' +
    ' aria-selected="' + selected + '" tabindex="' + (selected ? 0 : -1) + '">' + label + "</button>";
}

function tabPanel(id, visible, html) {
  return '<div class="tab-panel" role="tabpanel" id="panel-' + id + '" aria-labelledby="tab-' + id + '"' +
    (visible ? "" : " hidden") + ">" + html + "</div>";
}

function historyHtml(history) {
  if (history.length === 0) return '<p class="muted">Nobody has borrowed this book yet.</p>';
  const today = todayString();
  const rows = history.map((loan) => {
    let status = '<span class="pill pill-ok">Out</span>';
    if (loan.return_date) status = "Returned <time>" + esc(loan.return_date) + "</time>";
    else if (loan.due_date < today) status = '<span class="pill pill-out">Overdue</span>';
    return "<tr><td>" + esc(loan.first_name + " " + loan.last_name) + "</td><td>" + esc(loan.card) + "</td>" +
      "<td><time>" + esc(loan.issue_date) + "</time></td><td><time>" + esc(loan.due_date) + "</time></td>" +
      "<td>" + status + "</td></tr>";
  });
  return '<div class="table-wrap"><table class="table"><thead><tr>' +
    "<th><span>Patron</span></th><th><span>Card</span></th><th><span>Checked out</span></th>" +
    "<th><span>Due date</span></th><th><span>Status</span></th></tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  function select(tab) {
    selectTab(tabs, tab);
    tab.focus();
  }
  for (const tab of tabs) tab.addEventListener("click", () => select(tab));
  onTabArrows(tabs, select);
}

async function deleteBook(book) {
  if (!confirm('Delete "' + book.title + '"? This cannot be undone.')) return;
  const reply = await apiOrToast("/api/books", { action: "delete", id: book.id });
  if (!reply) return;
  toast('"' + book.title + '" was deleted.');
  setTimeout(() => { window.location.href = "library.html"; }, 700);
}

loadBook();
