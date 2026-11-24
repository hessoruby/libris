"""Run the real Java server against a disposable database; never touch user data."""
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[2]

with tempfile.TemporaryDirectory(prefix="libris-test-") as temporary:
    root = Path(temporary)
    backend = root / "backend"
    shutil.copytree(ROOT / "backend", backend, ignore=shutil.ignore_patterns("classes", "*.db", "*.db-*"))
    shutil.copytree(ROOT / "frontend", root / "frontend")
    classes = backend / "classes"
    subprocess.run(["javac", "--release", "17", "-d", str(classes),
                    *map(str, (backend / "src").glob("*.java")),
                    str(backend / "tests" / "SessionStoreTest.java")], check=True)
    subprocess.run(["java", "-cp", str(classes), "SessionStoreTest"], check=True)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    def request(path, data=None, cookie=None, headers=None):
        connection = http.client.HTTPConnection("localhost", port, timeout=5)
        request_headers = dict(headers or {})
        if cookie:
            request_headers["Cookie"] = cookie
        if data is not None:
            request_headers["Content-Type"] = "application/x-www-form-urlencoded"
        connection.request("GET" if data is None else "POST", path,
                           None if data is None else urlencode(data), request_headers)
        response = connection.getresponse()
        body = response.read()
        result = (response.status, dict(response.getheaders()),
                  json.loads(body) if "application/json" in response.getheader("Content-Type", "") else body)
        connection.close()
        return result

    with (root / "server.log").open("w+") as log:
        process = subprocess.Popen(["java", "-cp", os.pathsep.join([str(classes), str(backend / "sqlite-jdbc-3.49.1.0.jar")]), "JavaApp"],
                                   cwd=backend, env={**os.environ, "LIBRIS_PORT": str(port)}, stdout=log, stderr=log)
        try:
            for attempt in range(100):
                try:
                    if request("/api/login")[0] == 200:
                        break
                except OSError:
                    pass
                if process.poll() is not None:
                    log.seek(0)
                    raise RuntimeError(log.read())
                time.sleep(0.05)
            else:
                raise AssertionError("Server did not start")

            assert request("/api/books")[0] == 401
            assert request("/api/login", {"uname": "wrong", "pwd": "wrong"})[0] == 400
            status, headers, _ = request("/api/login", {"uname": "srm", "pwd": "ap"})
            assert status == 200
            cookie = headers["Set-cookie"].split(";", 1)[0]
            assert "HttpOnly" in headers["Set-cookie"] and "Max-Age=28800" in headers["Set-cookie"]
            assert request("/api/books", cookie=cookie)[0] == 200
            assert request("/api/books", {"action": "add"}, cookie)[0] == 400
            assert request("/api/books", {"action": "add"}, cookie, {"Origin": "https://other.example"})[0] == 403
            payload = {"action": "add", "title": "Smoke book", "author": "Test Author", "copies": 1}
            status, _, body = request("/api/books", payload, cookie)
            assert status == 200
            book_id = body["id"]
            assert request(f"/api/books?id={book_id}", cookie=cookie)[2]["book"]["title"] == "Smoke book"
            members = request("/api/members", cookie=cookie)[2]["members"]
            member_id = next(member["id"] for member in members if member["out_count"] < 5)
            checkout = {"action": "checkout", "book_id": book_id, "member_id": member_id}
            status, _, body = request("/api/loans", checkout, cookie)
            assert status == 200
            loan_id = body["id"]
            assert request("/api/loans", checkout, cookie)[0] == 400
            assert request("/api/books", {"action": "delete", "id": book_id}, cookie)[0] == 400
            assert request("/api/loans", {"action": "checkin", "loan_id": loan_id}, cookie)[0] == 200
            assert request("/api/loans", {"action": "checkin", "loan_id": loan_id}, cookie)[0] == 400
            assert request("/api/books", {"action": "delete", "id": book_id}, cookie)[0] == 200
            _, headers, _ = request("/api/login", {"uname": "srm", "pwd": "ap"}, cookie)
            replacement = headers["Set-cookie"].split(";", 1)[0]
            assert request("/api/books", cookie=cookie)[0] == 401
            assert request("/api/login", {"action": "logout"}, replacement)[0] == 200
            assert request("/api/books", cookie=replacement)[0] == 401
            assert request("/../backend/setup.sql")[0] == 404
            print("HTTP smoke: login, rotation, logout, origin checks, book CRUD, lending limits and traversal passed")
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
