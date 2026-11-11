import com.sun.net.httpserver.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

class WebPageHandler implements HttpHandler
{
        private final Path root;

        WebPageHandler(Path root) throws IOException
        {       this.root = root.toRealPath(); }

        public void handle(HttpExchange ex) throws IOException
        {
                String path = ex.getRequestURI().getPath();
                if (path.equals("/"))
                        path = "/login.html";
                Path file;
                try
                {       file = root.resolve(path.substring(1)).toRealPath(); }
                catch (Exception e)
                {       file = null; }
                if (file == null || !file.startsWith(root) || !Files.isRegularFile(file))
                {
                        WebHelper.send(ex, 404, "text/plain; charset=utf-8", "Page not found".getBytes(StandardCharsets.UTF_8));
                        return;
                }
                WebHelper.send(ex, 200, contentType(file.toString()), Files.readAllBytes(file));
        }

        private static String contentType(String name)
        {
                if (name.endsWith(".html")) return "text/html; charset=utf-8";
                if (name.endsWith(".css"))  return "text/css; charset=utf-8";
                if (name.endsWith(".js"))   return "text/javascript; charset=utf-8";
                if (name.endsWith(".svg"))  return "image/svg+xml";
                if (name.endsWith(".png"))  return "image/png";
                if (name.endsWith(".jpg"))  return "image/jpeg";
                if (name.endsWith(".ico"))  return "image/x-icon";
                return "application/octet-stream";
        }
}
