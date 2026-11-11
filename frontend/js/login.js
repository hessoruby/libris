const form = document.getElementById("login-form");
const message = document.getElementById("login-message");
const loginButton = document.getElementById("login-btn");

function showMessage(text, isError) {
  message.textContent = text;
  message.className = "message " + (isError ? "is-error" : "is-ok");
}

async function skipLoginIfLoggedIn() {
  try {
    const reply = await api("/api/login");
    if (reply.loggedIn) window.location.href = "library.html";
  } catch (error) {
  }
}
skipLoginIfLoggedIn();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const uname = document.getElementById("uname").value.trim();
  const pwd = document.getElementById("pwd").value;
  if (!uname || !pwd) {
    showMessage("Enter both User Name and Password.", true);
    return;
  }
  loginButton.disabled = true;
  try {
    const reply = await api("/api/login", { uname: uname, pwd: pwd });
    showMessage(reply.message, false);
    setTimeout(() => { window.location.href = "library.html"; }, 500);
  } catch (error) {
    showMessage(error.message, true);
    loginButton.disabled = false;
  }
});

form.addEventListener("reset", () => showMessage("", false));
