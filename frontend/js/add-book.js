const editId = param("id");
renderSidebar(editId ? "library" : "add");
document.getElementById("chip").innerHTML = libraryChipHtml();

const form = document.getElementById("book-form");
const message = document.getElementById("form-message");
const saveButton = document.getElementById("save-btn");

function field(name) {
  return form.elements.namedItem(name);
}

function updatePreview() {
  const title = field("title").value.trim() || "Book title";
  const author = field("author").value.trim() || "Author";
  document.getElementById("preview").innerHTML = coverHtml({ title: title, author: author }, "lg");
}
field("title").addEventListener("input", updatePreview);
field("author").addEventListener("input", updatePreview);

async function loadCategories() {
  try {
    const reply = await api("/api/books");
    const names = new Set(reply.books.filter((book) => book.category).map((book) => book.category));
    const sortedNames = Array.from(names).sort();
    document.getElementById("category-options").innerHTML = sortedNames.map((name) => '<option value="' + esc(name) + '">').join("");
  } catch (error) {  }
}

async function loadBookToEdit() {
  document.getElementById("page-title").textContent = "Edit Book";
  document.title = "Edit Book · Libris";
  saveButton.textContent = "Save Changes";
  document.getElementById("cancel-link").href = "book.html?id=" + encodeURIComponent(editId);
  try {
    const reply = await api("/api/books?id=" + encodeURIComponent(editId));
    for (const name of ["title", "author", "category", "publisher", "year", "pages", "isbn", "shelf", "copies", "description", "notes"]) {
      field(name).value = reply.book[name] ?? "";
    }
    updatePreview();
  } catch (error) {
    message.textContent = error.message;
    saveButton.disabled = true;
  }
}

function checkForm() {
  const problems = [];
  if (!field("title").value.trim()) problems.push({ input: field("title"), text: "Title is required." });
  if (!field("author").value.trim()) problems.push({ input: field("author"), text: "Author is required." });
  const copies = Number(field("copies").value);
  if (!Number.isInteger(copies) || copies < 1) {
    problems.push({ input: field("copies"), text: "Copies must be a whole number, 1 or more." });
  }
  markInvalid(form, problems.map((problem) => problem.input));
  message.textContent = problems.map((problem) => problem.text).join(" ");
  return problems.length === 0;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  if (!checkForm()) return;
  const data = Object.fromEntries(new FormData(form));
  data.action = editId ? "update" : "add";
  if (editId) data.id = editId;
  saveButton.disabled = true;
  try {
    const reply = await api("/api/books", data);
    toast(editId ? "Changes saved." : '"' + data.title + '" was added to the library.');
    setTimeout(() => { window.location.href = "book.html?id=" + reply.id; }, 600);
  } catch (error) {
    message.textContent = error.message;
    saveButton.disabled = false;
  }
});

updatePreview();
loadCategories();
if (editId) loadBookToEdit();
