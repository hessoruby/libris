import com.sun.net.httpserver.HttpExchange;
import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

class WebHelper
{
        public static Map<String, String> readParams(HttpExchange ex) throws IOException, WrongInputException
        {
                Map<String, String> params = new HashMap<>();
                addPairs(params, ex.getRequestURI().getRawQuery());
                if (ex.getRequestMethod().equals("POST"))
                        addPairs(params, new String(readAll(ex.getRequestBody()), StandardCharsets.UTF_8));
                return params;
        }

        private static void addPairs(Map<String, String> params, String text) throws UnsupportedEncodingException, WrongInputException
        {
                if (text == null || text.isEmpty())
                        return;
                for (String pair : text.split("&"))
                {
                        int eq = pair.indexOf('=');
                        if (eq < 0)
                                continue;
                        try
                        {
                                String key = URLDecoder.decode(pair.substring(0, eq), "UTF-8");
                                String value = URLDecoder.decode(pair.substring(eq + 1), "UTF-8");
                                if (value.length() > 10000)
                                        throw new WrongInputException("A value is too long (the most is 10000 characters).");
                                params.put(key, value.trim());
                        }
                        catch (IllegalArgumentException e)
                        {       throw new WrongInputException("Bad characters in the request."); }
                }
        }

        private static byte[] readAll(InputStream in) throws IOException, WrongInputException
        {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                for (int n = in.read(buffer); n != -1; n = in.read(buffer))
                {
                        out.write(buffer, 0, n);
                        if (out.size() > 1000000)
                                throw new WrongInputException("Request is too big.");
                }
                return out.toByteArray();
        }

        public static String cookie(HttpExchange ex, String name)
        {
                String header = ex.getRequestHeaders().getFirst("Cookie");
                if (header == null)
                        return null;
                for (String part : header.split(";"))
                {
                        String[] nameAndValue = part.trim().split("=", 2);
                        if (nameAndValue.length == 2 && nameAndValue[0].equals(name))
                                return nameAndValue[1];
                }
                return null;
        }

        public static void send(HttpExchange ex, int status, String contentType, byte[] data) throws IOException
        {
                ex.getResponseHeaders().set("Content-Type", contentType);
                ex.getResponseHeaders().set("Cache-Control", "no-store");
                ex.sendResponseHeaders(status, data.length == 0 ? -1 : data.length);
                OutputStream out = ex.getResponseBody();
                out.write(data);
                out.close();
        }

        public static void sendJson(HttpExchange ex, int status, String json) throws IOException
        {       send(ex, status, "application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8)); }

        public static Map<String, Object> map(Object... keysAndValues)
        {
                Map<String, Object> result = new LinkedHashMap<>();
                for (int i = 0; i + 1 < keysAndValues.length; i += 2)
                        result.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
                return result;
        }

        public static String json(Object value)
        {
                if (value == null)
                        return "null";
                if (value instanceof Number || value instanceof Boolean)
                        return value.toString();
                if (value instanceof Map)
                        return jsonObject((Map<?, ?>) value);
                if (value instanceof List)
                        return jsonList((List<?>) value);
                return jsonText(value.toString());
        }

        private static String jsonObject(Map<?, ?> fields)
        {
                StringBuilder sb = new StringBuilder("{");
                for (Map.Entry<?, ?> entry : fields.entrySet())
                {
                        if (sb.length() > 1)
                                sb.append(',');
                        sb.append(jsonText(String.valueOf(entry.getKey())));
                        sb.append(':');
                        sb.append(json(entry.getValue()));
                }
                sb.append('}');
                return sb.toString();
        }

        private static String jsonList(List<?> items)
        {
                StringBuilder sb = new StringBuilder("[");
                for (Object item : items)
                {
                        if (sb.length() > 1)
                                sb.append(',');
                        sb.append(json(item));
                }
                sb.append(']');
                return sb.toString();
        }

        private static String jsonText(String text)
        {
                StringBuilder sb = new StringBuilder("\"");
                for (char c : text.toCharArray())
                {
                        switch (c)
                        {
                                case '"':  sb.append("\\\""); break;
                                case '\\': sb.append("\\\\"); break;
                                case '\n': sb.append("\\n");  break;
                                case '\r': sb.append("\\r");  break;
                                case '\t': sb.append("\\t");  break;
                                default:
                                        if (c < 0x20)
                                                sb.append(String.format("\\u%04x", (int) c));
                                        else
                                                sb.append(c);
                        }
                }
                sb.append('"');
                return sb.toString();
        }
}
