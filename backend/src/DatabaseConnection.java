import java.sql.*;
import java.util.*;
import java.net.URI;

class DatabaseConnection
{
        public static Connection conn = null;
        public static Statement stmt = null;
        public static ResultSet rset = null;
        public static final boolean online = System.getenv("DATABASE_URL") != null;
        private static long newId;
        private static String localFile;

        public static void connect(String dbpath)
        {       try
                {
                localFile = dbpath;
                open();
                }
                catch (Exception e)
                {       System.out.println("Could not connect to the database."); }
        }

        private static void open() throws SQLException
        {
                if (online)
                {
                        URI address = URI.create(System.getenv("DATABASE_URL"));
                        String[] login = address.getUserInfo().split(":", 2);
                        Properties settings = new Properties();
                        settings.setProperty("user", login[0]);
                        settings.setProperty("password", login[1]);
                        settings.setProperty("sslmode", "verify-full");
                        settings.setProperty("sslfactory", "org.postgresql.ssl.DefaultJavaSSLFactory");
                        settings.setProperty("connectTimeout", "15");
                        conn = DriverManager.getConnection("jdbc:postgresql://" + address.getHost() + ":"
                                + (address.getPort() < 0 ? 5432 : address.getPort()) + address.getRawPath(), settings);
                }
                else
                {
                        conn = DriverManager.getConnection("jdbc:sqlite:" + localFile);
                        conn.createStatement().execute("PRAGMA foreign_keys = ON");
                }
                stmt = conn.createStatement();
        }

        private static void checkConnection() throws SQLException
        {
                if (conn == null || conn.isClosed() || (online && conn.getAutoCommit() && !conn.isValid(2)))
                        open();
        }

        public static void execute(String query)
        {       try
                {
                rset = stmt.executeQuery(query);
                }
                catch (Exception e)
                {       e.printStackTrace(); }
        }

        public static void run(String command) throws SQLException
        {
                checkConnection();
                stmt.executeUpdate(command);
        }

        public static List<Map<String, Object>> select(String query, Object... values) throws SQLException
        {
                List<Map<String, Object>> rows = new ArrayList<>();
                try (PreparedStatement ps = prepare(query, values))
                {
                        rset = ps.executeQuery();
                        ResultSetMetaData meta = rset.getMetaData();
                        while (rset.next())
                        {
                                Map<String, Object> row = new LinkedHashMap<>();
                                for (int i = 1; i <= meta.getColumnCount(); i++)
                                        row.put(meta.getColumnLabel(i), rset.getObject(i));
                                rows.add(row);
                        }
                }
                return rows;
        }

        public static Map<String, Object> selectOne(String query, Object... values) throws SQLException
        {
                List<Map<String, Object>> rows = select(query, values);
                return rows.isEmpty() ? null : rows.get(0);
        }

        public static int update(String query, Object... values) throws SQLException
        {
                try (PreparedStatement ps = prepare(query, values))
                {
                        int count = ps.executeUpdate();
                        if (online && query.trim().toLowerCase(Locale.ROOT).startsWith("insert "))
                                try (ResultSet keys = ps.getGeneratedKeys())
                                {
                                        if (keys.next() && keys.getObject(1) instanceof Number)
                                                newId = ((Number) keys.getObject(1)).longValue();
                                }
                        return count;
                }
        }

        public static long lastId() throws SQLException
        {
                if (online)
                        return newId;
                Map<String, Object> row = selectOne("select last_insert_rowid() as id");
                return ((Number) row.get("id")).longValue();
        }

        private static PreparedStatement prepare(String query, Object[] values) throws SQLException
        {
                checkConnection();
                if (online)
                {
                        query = query.replace("printf('B%04d', b.id)", "'B' || lpad(b.id::text, greatest(4, length(b.id::text)), '0')")
                                .replace("printf('M%04d', m.id)", "'M' || lpad(m.id::text, greatest(4, length(m.id::text)), '0')")
                                .replace(" like ?", " ilike ?");
                }
                PreparedStatement ps = online ? conn.prepareStatement(query, Statement.RETURN_GENERATED_KEYS)
                        : conn.prepareStatement(query);
                for (int i = 0; i < values.length; i++)
                        ps.setObject(i + 1, values[i]);
                return ps;
        }
}
