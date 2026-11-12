import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.nio.file.*;

public class JavaApp
{
        static final int PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        public static void main(String[] args) throws Exception
        {
                if (!Files.exists(Paths.get("setup.sql")))
                {
                        System.out.println("Please run this program from inside the backend folder.");
                        return;
                }
                DatabaseConnection.connect(System.getenv().getOrDefault("DATABASE_PATH", "javaapp.db"));
                if (DatabaseConnection.conn == null)
                {
                        System.out.println("Could not open javaapp.db. Is sqlite-jdbc-3.49.1.0.jar in the -cp list?");
                        return;
                }
                DatabaseSetup.setup("setup.sql");
                Path frontend = Paths.get("..", "frontend").toAbsolutePath().normalize();
                if (!Files.isDirectory(frontend))
                {
                        System.out.println("Could not find the frontend folder at " + frontend);
                        return;
                }
                HttpServer server;
                try
                {       server = HttpServer.create(new InetSocketAddress(System.getenv("PORT") == null ? "localhost" : "0.0.0.0", PORT), 0); }
                catch (BindException e)
                {
                        System.out.println("Port " + PORT + " is busy. Is the app already running in another terminal?");
                        return;
                }
                server.createContext("/api/login", new LoginHandler());
                server.createContext("/api/books", new BookHandler());
                server.createContext("/api/members", new MemberHandler());
                server.createContext("/api/loans", new LendingHandler());
                server.createContext("/", new WebPageHandler(frontend));
                server.start();
                System.out.println("Library app is running.");
                System.out.println("Open http://localhost:" + PORT + " in your browser (login: srm / ap).");
                System.out.println("Press Ctrl+C here to stop it.");
        }
}
