import com.sun.net.httpserver.*;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

abstract class RequestHandler implements HttpHandler
{
        protected boolean needsLogin = true;

        protected abstract String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception;

        public void handle(HttpExchange ex) throws IOException
        {
                String method = ex.getRequestMethod();
                try
                {
                        if (!fromOurOwnPage(ex))
                                sendError(ex, 403, "Requests from other websites are not allowed.");
                        else if (!method.equals("GET") && !method.equals("POST"))
                                sendError(ex, 405, "Only GET and POST are allowed.");
                        else if (needsLogin && !LoginHandler.isLoggedIn(ex))
                                sendError(ex, 401, "Please log in first.");
                        else
                                WebHelper.sendJson(ex, 200, answer(method, WebHelper.readParams(ex), ex));
                }
                catch (WrongInputException e)
                {       sendError(ex, 400, e.getMessage()); }
                catch (Exception e)
                {
                        e.printStackTrace();
                        sendError(ex, 500, "Something went wrong. Please try again.");
                }
        }

        private static void sendError(HttpExchange ex, int status, String message) throws IOException
        {       WebHelper.sendJson(ex, status, WebHelper.json(WebHelper.map("error", message))); }

        private String answer(String method, Map<String, String> params, HttpExchange ex) throws Exception
        {
                if (!DatabaseConnection.online || !method.equals("POST"))
                        return reply(method, params, ex);
                DatabaseConnection.conn.setAutoCommit(false);
                try
                {
                        DatabaseConnection.selectOne("select pg_advisory_xact_lock(73611825)");
                        String response = reply(method, params, ex);
                        DatabaseConnection.conn.commit();
                        return response;
                }
                catch (Exception e)
                {
                        DatabaseConnection.conn.rollback();
                        throw e;
                }
                finally
                {       DatabaseConnection.conn.setAutoCommit(true); }
        }

        private static boolean fromOurOwnPage(HttpExchange ex)
        {
                String host = ex.getRequestHeaders().getFirst("Host");
                String origin = ex.getRequestHeaders().getFirst("Origin");
                boolean goodHost = ("localhost:" + JavaApp.PORT).equals(host) || ("127.0.0.1:" + JavaApp.PORT).equals(host);
                String publicHost = System.getenv("PUBLIC_HOST");
                boolean onlineHost = host != null && (host.equals(publicHost) || host.equals(System.getenv("VERCEL_URL")));
                return (goodHost && (origin == null || origin.equals("http://" + host)))
                        || (onlineHost && (origin == null || origin.equals("https://" + host)));
        }

        protected static String required(Map<String, String> p, String key, String label) throws WrongInputException
        {
                String v = optional(p, key);
                if (v == null)
                        throw new WrongInputException(label + " is required.");
                return v;
        }

        protected static String optional(Map<String, String> p, String key)
        {
                String v = p.get(key);
                return (v == null || v.isEmpty()) ? null : v;
        }

        protected static Integer number(Map<String, String> p, String key, String label, boolean needed, int min, int max) throws WrongInputException
        {
                String v = needed ? required(p, key, label) : optional(p, key);
                if (v == null)
                        return null;
                int n;
                try
                {       n = Integer.parseInt(v); }
                catch (NumberFormatException e)
                {       throw new WrongInputException(label + " must be a whole number."); }
                if (n < min || n > max)
                        throw new WrongInputException(label + " must be between " + min + " and " + max + ".");
                return n;
        }

        protected static LocalDate date(Map<String, String> p, String key, String label, LocalDate fallback) throws WrongInputException
        {
                String v = optional(p, key);
                if (v == null)
                        return fallback;
                try
                {       return LocalDate.parse(v); }
                catch (DateTimeParseException e)
                {       throw new WrongInputException(label + " must be a date like 2026-11-10."); }
        }

        protected static String searchPattern(Map<String, String> p)
        {       return "%" + p.getOrDefault("q", "") + "%"; }

        protected static int intOf(Map<String, Object> row, String key)
        {       return ((Number) row.get(key)).intValue(); }
}
