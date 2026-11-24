# Libris

A simple library management system built with Java.

Browse and search a SQLite book catalogue, manage members, and check books out and back in through a browser UI. The backend uses Java's HTTP server and prepared SQL statements; the frontend is plain HTML, CSS, and JavaScript.

## Download the project

1. On this GitHub page, click **Code**.
2. Click **Download ZIP**.
3. Unzip the file.

## Run on your laptop

1. Install [Java JDK 17 or newer](https://adoptium.net/).
2. Open the project folder.
3. **Windows:** open the `run` folder and double-click `run.bat`.
4. **Mac or Linux:** open a terminal in the project folder and run `bash run/run.sh`.
5. The browser opens `http://localhost:8080`.
6. Log in with user name **srm** and password **ap**.

To stop the app, close the terminal or press **Ctrl+C**.

To bring back the sample books and members, stop the app, run `run/reset.bat` on Windows or `bash run/reset.sh` on Mac or Linux, then start again.

**Reset deletes the local library database.** Back up `backend/javaapp.db` first if you want to keep your records.

## Verification

With JDK 17+ and Python 3 installed, run `python3 backend/tests/smoke.py` (or `python` on Windows). It compiles the Java sources, checks session expiry, and exercises login, book CRUD, lending, origin checks, and logout against a temporary database. Your working database is untouched.

## Scope

This is a local portfolio demo, not a multi-user production service. It binds to localhost. The seeded `srm` / `ap` account and plaintext demo passwords must be replaced with proper credential storage and account management before deployment. Sessions expire after eight hours and are cleared when the server stops. There is no password reset, role management, audit trail, or automated backup system.

The server defaults to port 8080. Set `LIBRIS_PORT` to another available port if needed. Data stays in `backend/javaapp.db`; generated classes and databases are ignored by Git.
