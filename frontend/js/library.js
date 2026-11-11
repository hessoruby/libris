renderSidebar("library");
document.getElementById("chip").innerHTML = libraryChipHtml();

const shelf = document.getElementById("shelf");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

const state = {
  books: [],
  search: "",
  sort: "title",
  ascending: true,
  view: "cover",
  letter: "ALL",
  categories: new Set(),
  freeOnly: false
};

try { state.view = localStorage.getItem("libraryView") || "cover"; } catch (e) {  }

async function loadBooks() {
  shelf.innerHTML = '<p class="empty">Loading books…</p>';
  try {
    const reply = await api("/api/books");
    state.books = reply.books;
    buildCategoryFilters();
    render();
  } catch (error) {
    shelf.innerHTML = '<div class="empty"><strong>Could not load the books.</strong>' + esc(error.message) + "</div>";
  }
}

function sortText(book) {
  return state.sort === "author" ? book.author : book.title;
}

function letterOf(book) {
  const first = sortText(book).trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

function matchesSearchAndFilters(book) {
  const texts = [book.title, book.author, book.isbn, book.code, book.category, book.publisher];
  if (!textMatches(state.search.toLowerCase(), texts)) return false;
  if (state.categories.size > 0 && !state.categories.has(book.category || "Uncategorised")) return false;
  if (state.freeOnly && book.copies - book.out_count <= 0) return false;
  return true;
}

function compareBooks(a, b) {
  let result;
  if (state.sort === "added") result = String(a.added).localeCompare(String(b.added));
  else result = sortText(a).localeCompare(sortText(b), undefined, { sensitivity: "base" });
  return state.ascending ? result : -result;
}

function render() {
  const matching = state.books.filter(matchesSearchAndFilters).sort(compareBooks);
  const grouped = state.sort !== "added";
  if (!grouped) state.letter = "ALL";
  let shown = matching;
  if (state.letter !== "ALL") shown = matching.filter((book) => letterOf(book) === state.letter);
  document.getElementById("count").textContent = shown.length;
  renderToolbar();
  renderLetters(matching, grouped);
  if (shown.length > 0) {
    shelf.innerHTML = state.view === "list" ? listHtml(shown) : coverViewHtml(shown, grouped);
  } else if (state.books.length === 0) {
    shelf.innerHTML = '<div class="empty"><strong>No books yet.</strong><a href="add-book.html">Add your first book</a></div>';
  } else {
    shelf.innerHTML = '<div class="empty"><strong>No books match.</strong>Try another search, or ' +
      '<button class="btn btn-small" type="button" id="reset-view">clear search and filters</button></div>';
    document.getElementById("reset-view").addEventListener("click", clearEverything);
  }
}

function cardsHtml(books) {
  return '<ul class="book-grid">' + books.map((book) => cardHtml(book)).join("") + "</ul>";
}

function coverViewHtml(books, grouped) {
  if (!grouped) return cardsHtml(books);
  const order = state.ascending ? LETTERS : LETTERS.slice().reverse();
  return order.map((letter) => {
    const group = books.filter((book) => letterOf(book) === letter);
    if (group.length === 0) return "";
    return '<h2 class="letter-head" id="letter-' + letter + '">' + letter + "</h2>" + cardsHtml(group);
  }).join("");
}

function cardHtml(book) {
  const free = book.copies - book.out_count;
  return '<li><a class="book-card" href="book.html?id=' + book.id + '">' + coverHtml(book) +
    '<span class="book-card-title" title="' + esc(book.title) + '">' + esc(book.title) + "</span>" +
    '<span class="book-card-author">' + esc(book.author) + "</span>" +
    '<span class="visually-hidden">, ' + free + " of " + book.copies + " copies free</span></a></li>";
}

function listHtml(books) {
  const rows = books.map((book) => {
    const free = book.copies - book.out_count;
    return '<tr><td><div class="item-cell">' + coverHtml(book, "sm") +
        '<div><a href="book.html?id=' + book.id + '">' + esc(book.title) + "</a>" +
        '<div class="sub">' + esc(book.author) + "</div></div></div></td>" +
      "<td>" + esc(book.category || "—") + "</td>" +
      "<td>" + esc(book.year || "—") + "</td>" +
      "<td>" + (book.shelf ? '<span class="chip">' + esc(book.shelf) + "</span>" : "—") + "</td>" +
      '<td><span class="code">' + icon("barcode") + esc(book.code) + "</span></td>" +
      '<td><span class="pill ' + (free > 0 ? "pill-ok" : "pill-out") + '">' + free + " / " + book.copies + " free</span></td></tr>";
  });
  return '<div class="table-wrap"><table class="table"><thead><tr>' +
    "<th><span>Item</span></th><th><span>Category</span></th><th><span>Year</span></th>" +
    "<th><span>Shelf</span></th><th><span>Code</span></th><th><span>Copies</span></th>" +
    "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}

function renderLetters(matching, grouped) {
  const alpha = document.getElementById("alpha");
  if (!grouped) {
    alpha.innerHTML = "";
    return;
  }
  const used = new Set(matching.map((book) => letterOf(book)));
  alpha.innerHTML = LETTERS.concat("ALL").map((letter) => {
    const disabled = letter !== "ALL" && !used.has(letter) ? " disabled" : "";
    const pressed = state.letter === letter ? "true" : "false";
    return '<li><button type="button" data-letter="' + letter + '" aria-pressed="' + pressed + '"' + disabled + ">" + letter + "</button></li>";
  }).join("");
}

function renderToolbar() {
  const viewButton = document.getElementById("view-btn");
  const otherView = state.view === "cover" ? "list" : "cover";
  viewButton.innerHTML = state.view === "cover" ? icon("grid") + "Cover" : icon("list") + "List";
  viewButton.setAttribute("aria-label", "View: " + state.view + ". Click to switch to " + otherView + " view.");
  const dirButton = document.getElementById("dir-btn");
  dirButton.innerHTML = icon(state.ascending ? "arrowDown" : "arrowUp");
  dirButton.setAttribute("aria-label", state.ascending ? "Sorted A to Z. Click for Z to A." : "Sorted Z to A. Click for A to Z.");
  const active = state.categories.size + (state.freeOnly ? 1 : 0);
  document.getElementById("filter-btn").innerHTML = icon("filter") + (active > 0 ? "Filters (" + active + ")" : "Filters");
}

function buildCategoryFilters() {
  const names = new Set(state.books.map((book) => book.category || "Uncategorised"));
  const sortedNames = Array.from(names).sort();
  document.getElementById("category-list").innerHTML = sortedNames.map((name) => {
    const checked = state.categories.has(name) ? " checked" : "";
    return '<label class="check"><input type="checkbox" value="' + esc(name) + '"' + checked + "> " + esc(name) + "</label>";
  }).join("");
}

function clearEverything() {
  state.search = "";
  state.letter = "ALL";
  state.categories.clear();
  state.freeOnly = false;
  document.getElementById("search").value = "";
  document.getElementById("free-only").checked = false;
  buildCategoryFilters();
  render();
}

document.getElementById("search").addEventListener("input", debounce((event) => {
  state.search = event.target.value.trim();
  state.letter = "ALL";
  render();
}, 150));

document.getElementById("sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  state.letter = "ALL";
  render();
});

document.getElementById("dir-btn").addEventListener("click", () => {
  state.ascending = !state.ascending;
  render();
});

document.getElementById("view-btn").addEventListener("click", () => {
  state.view = state.view === "cover" ? "list" : "cover";
  try { localStorage.setItem("libraryView", state.view); } catch (e) {  }
  render();
});

document.getElementById("alpha").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-letter]");
  if (!button) return;
  state.letter = button.dataset.letter;
  render();
});

const filterButton = document.getElementById("filter-btn");
const filterPop = document.getElementById("filters-pop");

function setFiltersOpen(open) {
  filterPop.hidden = !open;
  filterButton.setAttribute("aria-expanded", String(open));
}
filterButton.addEventListener("click", () => setFiltersOpen(filterPop.hidden));
document.addEventListener("click", (event) => {
  if (!filterPop.hidden && !event.target.closest(".filters")) setFiltersOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !filterPop.hidden) {
    setFiltersOpen(false);
    filterButton.focus();
  }
});

document.getElementById("category-list").addEventListener("change", (event) => {
  if (event.target.checked) state.categories.add(event.target.value);
  else state.categories.delete(event.target.value);
  state.letter = "ALL";
  render();
});
document.getElementById("free-only").addEventListener("change", (event) => {
  state.freeOnly = event.target.checked;
  state.letter = "ALL";
  render();
});
document.getElementById("clear-filters").addEventListener("click", clearEverything);

loadBooks();
