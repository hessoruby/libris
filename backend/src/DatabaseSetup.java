import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.SQLException;

class DatabaseSetup
{
        public static void setup(String sqlFile) throws Exception
        {
                boolean tablesExist = DatabaseConnection.selectOne(
                        "select name from sqlite_master where type='table' and name='books'") != null;
                if (tablesExist)
                {
                        boolean hasApNumber = DatabaseConnection.selectOne(
                                "select name from pragma_table_info('members') where name = 'ap_number'") != null;
                        if (!hasApNumber)
                        {
                                System.out.println("javaapp.db is from an older version of the app. Run run/reset first, then start again.");
                                System.exit(1);
                        }
                        return;
                }
                System.out.println("First run: creating the tables from " + sqlFile + " ...");
                String script = new String(Files.readAllBytes(Paths.get(sqlFile)), StandardCharsets.UTF_8);
                StringBuilder clean = new StringBuilder();
                for (String line : script.split("\n"))
                        if (!line.trim().startsWith("--"))
                                clean.append(line).append("\n");
                DatabaseConnection.conn.setAutoCommit(false);
                try
                {
                        for (String command : clean.toString().split(";"))
                                if (!command.trim().isEmpty())
                                        DatabaseConnection.run(command);
                        DatabaseConnection.conn.commit();
                }
                catch (SQLException e)
                {
                        DatabaseConnection.conn.rollback();
                        throw e;
                }
                finally
                {       DatabaseConnection.conn.setAutoCommit(true); }
                System.out.println("Tables created and sample data added.");
        }
}
