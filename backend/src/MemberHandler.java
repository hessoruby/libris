import com.sun.net.httpserver.HttpExchange;
import java.time.LocalDate;
import java.util.*;

class MemberHandler extends RequestHandler
{
        static final String COLUMNS =
                "m.*, printf('M%04d', m.id) as card, "
              + "(select count(*) from loans l where l.member_id = m.id and l.return_date is null) as out_count";

        protected String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception
        {
                if (method.equals("GET"))
                {
                        String q = searchPattern(p);
                        List<Map<String, Object>> members = DatabaseConnection.select(
                                "select " + COLUMNS + " from members m "
                              + "where (m.first_name || ' ' || m.last_name) like ? or m.email like ? "
                              + "or m.phone like ? or printf('M%04d', m.id) like ? or m.ap_number like ? "
                              + "order by m.first_name collate nocase, m.last_name collate nocase", q, q, q, q, q);
                        return WebHelper.json(WebHelper.map("members", members));
                }
                String action = required(p, "action", "Action");
                if (action.equals("add"))
                        return add(p);
                if (action.equals("update"))
                        return update(p);
                if (action.equals("delete"))
                        return delete(p);
                throw new WrongInputException("Unknown action: " + action);
        }

        static Map<String, Object> find(int id) throws Exception
        {
                Map<String, Object> member = DatabaseConnection.selectOne("select " + COLUMNS + " from members m where m.id = ?", id);
                if (member == null)
                        throw new WrongInputException("There is no member with id " + id + ".");
                return member;
        }

        private static List<Object> readForm(Map<String, String> p, int idToSkip) throws Exception
        {
                String firstName = required(p, "first_name", "First name");
                String lastName  = required(p, "last_name", "Last name");
                String apNumber = required(p, "ap_number", "AP number").toUpperCase();
                if (!apNumber.matches("AP[0-9]{11}"))
                        throw new WrongInputException("AP number must look like AP24110010479.");
                Map<String, Object> sameAp = DatabaseConnection.selectOne(
                        "select id from members where ap_number = ? and id <> ?", apNumber, idToSkip);
                if (sameAp != null)
                        throw new WrongInputException("Another member already has this AP number.");

                String email = optional(p, "email");
                if (email != null)
                {
                        if (email.length() > 120)
                                throw new WrongInputException("Email is too long.");
                        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+"))
                                throw new WrongInputException("Email must look like name@example.com.");
                        Map<String, Object> sameEmail = DatabaseConnection.selectOne(
                                "select id from members where lower(email) = lower(?) and id <> ?", email, idToSkip);
                        if (sameEmail != null)
                                throw new WrongInputException("Another member already uses this email.");
                }

                String phone = optional(p, "phone");
                if (phone != null)
                {
                        int digits = phone.replaceAll("[^0-9]", "").length();
                        if (!phone.matches("[0-9+\\- ]+") || digits < 7 || digits > 15)
                                throw new WrongInputException("Phone must have 7 to 15 digits.");
                }
                return new ArrayList<Object>(Arrays.asList(firstName, lastName, apNumber, email, phone));
        }

        private String add(Map<String, String> p) throws Exception
        {
                List<Object> fields = readForm(p, 0);
                fields.add(LocalDate.now().toString());
                DatabaseConnection.update("insert into members(first_name, last_name, ap_number, email, phone, joined) values(?,?,?,?,?,?)", fields.toArray());
                return WebHelper.json(WebHelper.map("ok", true, "id", DatabaseConnection.lastId()));
        }

        private String update(Map<String, String> p) throws Exception
        {
                int id = number(p, "id", "Member id", true, 1, Integer.MAX_VALUE);
                find(id);
                List<Object> fields = readForm(p, id);
                fields.add(id);
                DatabaseConnection.update("update members set first_name=?, last_name=?, ap_number=?, email=?, phone=? where id=?", fields.toArray());
                return WebHelper.json(WebHelper.map("ok", true, "id", id));
        }

        private String delete(Map<String, String> p) throws Exception
        {
                int id = number(p, "id", "Member id", true, 1, Integer.MAX_VALUE);
                int outCount = intOf(find(id), "out_count");
                if (outCount > 0)
                        throw new WrongInputException("This member still has " + outCount + " book(s). Check them in before deleting the member.");
                DatabaseConnection.update("delete from loans where member_id = ?", id);
                DatabaseConnection.update("delete from members where id = ?", id);
                return WebHelper.json(WebHelper.map("ok", true));
        }
}
