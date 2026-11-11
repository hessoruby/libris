import com.sun.net.httpserver.HttpExchange;
import java.util.*;

class LoginHandler extends RequestHandler
{
        private static Set<String> sessions = new HashSet<>();

        LoginHandler()
        {       needsLogin = false; }

        protected String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception
        {
                if (method.equals("GET"))
                        return WebHelper.json(WebHelper.map("loggedIn", isLoggedIn(ex)));
                if ("logout".equals(p.get("action")))
                {
                        sessions.remove(WebHelper.cookie(ex, "session"));
                        ex.getResponseHeaders().add("Set-Cookie", "session=; Path=/; Max-Age=0");
                        return WebHelper.json(WebHelper.map("ok", true));
                }
                String uname = required(p, "uname", "User name");
                String pwd = required(p, "pwd", "Password");
                Map<String, Object> user = DatabaseConnection.selectOne(
                        "select uname from users where uname = ? and pwd = ?", uname, pwd);
                if (user == null)
                        throw new WrongInputException("Invalid user name or password");
                String sessionId = UUID.randomUUID().toString();
                sessions.add(sessionId);
                ex.getResponseHeaders().add("Set-Cookie", "session=" + sessionId + "; Path=/; HttpOnly; SameSite=Strict");
                return WebHelper.json(WebHelper.map("ok", true, "user", uname, "message", "Login success..."));
        }

        public static boolean isLoggedIn(HttpExchange ex)
        {
                String sessionId = WebHelper.cookie(ex, "session");
                return sessionId != null && sessions.contains(sessionId);
        }
}
