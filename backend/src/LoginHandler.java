import com.sun.net.httpserver.HttpExchange;
import java.util.*;

class LoginHandler extends RequestHandler
{
        private static final String COOKIE_OPTIONS = "; Path=/; HttpOnly; SameSite=Strict"
                + (System.getenv("VERCEL") != null ? "; Secure" : "");

        LoginHandler()
        {       needsLogin = false; }

        protected String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception
        {
                if (method.equals("GET"))
                        return WebHelper.json(WebHelper.map("loggedIn", isLoggedIn(ex)));
                if ("logout".equals(p.get("action")))
                {
                        if (!LoginToken.enabled())
                                DatabaseConnection.update("delete from sessions where id = ?", WebHelper.cookie(ex, "session"));
                        ex.getResponseHeaders().add("Set-Cookie", "session=; Max-Age=0" + COOKIE_OPTIONS);
                        return WebHelper.json(WebHelper.map("ok", true));
                }
                String uname = required(p, "uname", "User name");
                String pwd = required(p, "pwd", "Password");
                Map<String, Object> user = DatabaseConnection.selectOne(
                        "select uname from users where uname = ? and pwd = ?", uname, pwd);
                if (user == null)
                        throw new WrongInputException("Invalid user name or password");
                String sessionId = UUID.randomUUID().toString();
                long now = System.currentTimeMillis();
                if (LoginToken.enabled())
                        sessionId = LoginToken.create();
                else
                {
                        DatabaseConnection.update("delete from sessions where expires_at <= ?", now);
                        DatabaseConnection.update("insert into sessions(id, expires_at) values(?, ?)", sessionId, now + 28800000);
                }
                ex.getResponseHeaders().add("Set-Cookie", "session=" + sessionId + "; Max-Age=28800" + COOKIE_OPTIONS);
                return WebHelper.json(WebHelper.map("ok", true, "user", uname, "message", "Login success..."));
        }

        public static boolean isLoggedIn(HttpExchange ex) throws Exception
        {
                String sessionId = WebHelper.cookie(ex, "session");
                if (LoginToken.enabled())
                        return LoginToken.valid(sessionId);
                return sessionId != null && DatabaseConnection.selectOne(
                        "select id from sessions where id = ? and expires_at > ?", sessionId, System.currentTimeMillis()) != null;
        }
}
