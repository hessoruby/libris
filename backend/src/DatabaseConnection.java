import java.sql.*;
import java.util.*;

class DatabaseConnection
{
        public static Connection conn = null;
        public static Statement stmt = null;
        public static ResultSet rset = null;

        public static void connect(String dbpath)
        {       try
                {
                Class.forName("org.sqlite.JDBC");
                conn = DriverManager.getConnection("jdbc:sqlite:" + dbpath);
                stmt = conn.createStatement();
                stmt.execute("PRAGMA foreign_keys = ON");
                }
                catch (Exception e)
                {       e.printStackTrace(); }
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
        {       stmt.executeUpdate(command); }

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
                {       return ps.executeUpdate(); }
        }

        public static long lastId() throws SQLException
        {
                Map<String, Object> row = selectOne("select last_insert_rowid() as id");
                return ((Number) row.get("id")).longValue();
        }

        private static PreparedStatement prepare(String query, Object[] values) throws SQLException
        {
                PreparedStatement ps = conn.prepareStatement(query);
                for (int i = 0; i < values.length; i++)
                        ps.setObject(i + 1, values[i]);
                return ps;
        }
}
