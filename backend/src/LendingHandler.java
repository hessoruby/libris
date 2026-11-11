import com.sun.net.httpserver.HttpExchange;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

class LendingHandler extends RequestHandler
{
        static final int LOAN_DAYS = 14;
        static final int MAX_BOOKS_PER_MEMBER = 5;

        protected String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception
        {
                if (method.equals("GET"))
                        return list(p);
                String action = required(p, "action", "Action");
                if (action.equals("checkout"))
                        return checkout(p);
                if (action.equals("checkin"))
                        return checkin(p);
                throw new WrongInputException("Unknown action: " + action);
        }

        private String list(Map<String, String> p) throws Exception
        {
                String today = LocalDate.now().toString();
                String status = p.getOrDefault("status", "active");
                StringBuilder where = new StringBuilder(" where 1=1");
                List<Object> values = new ArrayList<>();
                if (status.equals("active"))
                        where.append(" and l.return_date is null");
                else if (status.equals("overdue"))
                {
                        where.append(" and l.return_date is null and l.due_date < ?");
                        values.add(today);
                }
                else if (status.equals("returned"))
                        where.append(" and l.return_date is not null");
                if (p.containsKey("member_id"))
                {
                        where.append(" and l.member_id = ?");
                        values.add(number(p, "member_id", "Member id", true, 1, Integer.MAX_VALUE));
                }
                if (optional(p, "q") != null)
                {
                        String q = searchPattern(p);
                        where.append(" and (b.title like ? or b.author like ? or (m.first_name || ' ' || m.last_name) like ?"
                                   + " or printf('B%04d', b.id) like ?)");
                        Collections.addAll(values, q, q, q, q);
                }
                List<Map<String, Object>> loans = DatabaseConnection.select(
                        "select l.*, b.title, b.author, b.shelf, b.cover, printf('B%04d', b.id) as code, "
                      + "m.first_name, m.last_name, printf('M%04d', m.id) as card "
                      + "from loans l join books b on b.id = l.book_id join members m on m.id = l.member_id"
                      + where + " order by l.return_date is not null, l.due_date, l.id", values.toArray());
                LocalDate now = LocalDate.now();
                for (Map<String, Object> loan : loans)
                {
                        LocalDate due = LocalDate.parse((String) loan.get("due_date"));
                        if (loan.get("return_date") != null)
                                loan.put("status", "returned");
                        else if (due.isBefore(now))
                        {
                                loan.put("status", "overdue");
                                loan.put("days_overdue", ChronoUnit.DAYS.between(due, now));
                        }
                        else
                        {
                                loan.put("status", "out");
                                loan.put("days_left", ChronoUnit.DAYS.between(now, due));
                        }
                }
                return WebHelper.json(WebHelper.map("loans", loans, "today", today));
        }

        private String checkout(Map<String, String> p) throws Exception
        {
                int bookId = number(p, "book_id", "Book", true, 1, Integer.MAX_VALUE);
                int memberId = number(p, "member_id", "Patron", true, 1, Integer.MAX_VALUE);
                LocalDate issue = date(p, "issue_date", "Checked out date", LocalDate.now());
                LocalDate due = date(p, "due_date", "Due date", issue.plusDays(LOAN_DAYS));
                if (issue.isAfter(LocalDate.now()))
                        throw new WrongInputException("Checked out date cannot be in the future.");
                if (due.isBefore(issue))
                        throw new WrongInputException("Due date must be on or after the checked out date.");
                Map<String, Object> book = BookHandler.find(bookId);
                Map<String, Object> member = MemberHandler.find(memberId);
                int free = intOf(book, "copies") - intOf(book, "out_count");
                if (free <= 0)
                        throw new WrongInputException("No free copies of \"" + book.get("title") + "\" are left.");
                if (intOf(member, "out_count") >= MAX_BOOKS_PER_MEMBER)
                        throw new WrongInputException(member.get("first_name") + " already has " + MAX_BOOKS_PER_MEMBER + " books, the most allowed.");
                Map<String, Object> sameLoan = DatabaseConnection.selectOne(
                        "select id from loans where book_id = ? and member_id = ? and return_date is null", bookId, memberId);
                if (sameLoan != null)
                        throw new WrongInputException(member.get("first_name") + " already has a copy of \"" + book.get("title") + "\".");
                DatabaseConnection.update("insert into loans(book_id, member_id, issue_date, due_date) values(?,?,?,?)",
                             bookId, memberId, issue.toString(), due.toString());
                return WebHelper.json(WebHelper.map("ok", true, "id", DatabaseConnection.lastId(), "due_date", due.toString()));
        }

        private String checkin(Map<String, String> p) throws Exception
        {
                int loanId = number(p, "loan_id", "Loan", true, 1, Integer.MAX_VALUE);
                Map<String, Object> loan = DatabaseConnection.selectOne("select * from loans where id = ?", loanId);
                if (loan == null)
                        throw new WrongInputException("There is no loan with id " + loanId + ".");
                if (loan.get("return_date") != null)
                        throw new WrongInputException("This book was already checked in on " + loan.get("return_date") + ".");
                LocalDate today = LocalDate.now();
                LocalDate due = LocalDate.parse((String) loan.get("due_date"));
                DatabaseConnection.update("update loans set return_date = ? where id = ?", today.toString(), loanId);
                long late = due.isBefore(today) ? ChronoUnit.DAYS.between(due, today) : 0;
                return WebHelper.json(WebHelper.map("ok", true, "days_late", late));
        }
}
