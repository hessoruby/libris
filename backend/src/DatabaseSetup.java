import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.SQLException;

class DatabaseSetup
{
        public static void setup(String sqlFile) throws Exception
        {
                DatabaseConnection.conn.setAutoCommit(false);
                try
                {
                        if (DatabaseConnection.online)
                                DatabaseConnection.selectOne("select pg_advisory_xact_lock(73611824)");
                        boolean tablesExist = DatabaseConnection.selectOne(
                                DatabaseConnection.online
                                ? "select table_name from information_schema.tables where table_schema='public' and table_name='books'"
                                : "select name from sqlite_master where type='table' and name='books'") != null;
                        if (tablesExist && !DatabaseConnection.online)
                        {
                                boolean hasApNumber = DatabaseConnection.selectOne(
                                        "select name from pragma_table_info('members') where name = 'ap_number'") != null;
                                if (!hasApNumber)
                                        throw new SQLException("The local database is old. Run run/reset, then start again.");
                        }
                        if (!tablesExist)
                        {
                                if (DatabaseConnection.online)
                                        sqlFile = "setup-postgres.sql";
                                System.out.println("First run: creating the tables from " + sqlFile + " ...");
                                String script = new String(Files.readAllBytes(Paths.get(sqlFile)), StandardCharsets.UTF_8);
                                for (String command : script.split(";"))
                                        if (!command.trim().isEmpty())
                                                DatabaseConnection.run(command);
                                System.out.println("Tables created and sample data added.");
                        }
                        DatabaseConnection.run("create table if not exists sessions(id text primary key, expires_at bigint not null)");
                        DatabaseConnection.conn.commit();
                }
                catch (SQLException e)
                {
                        DatabaseConnection.conn.rollback();
                        throw e;
                }
                finally
                {       DatabaseConnection.conn.setAutoCommit(true); }
        }
}
