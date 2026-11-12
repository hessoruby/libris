import com.sun.net.httpserver.HttpExchange;
import java.time.LocalDate;
import java.util.*;

class BookHandler extends RequestHandler
{
        static final String COLUMNS =
                "b.*, printf('B%04d', b.id) as code, "
              + "(select count(*) from loans l where l.book_id = b.id and l.return_date is null) as out_count";

        protected String reply(String method, Map<String, String> p, HttpExchange ex) throws Exception
        {
                if (method.equals("GET") && p.containsKey("id"))
                        return details(number(p, "id", "Book id", true, 1, Integer.MAX_VALUE));
                if (method.equals("GET"))
                {
                        String q = searchPattern(p);
                        List<Map<String, Object>> books = DatabaseConnection.select(
                                "select " + COLUMNS + " from books b "
                              + "where b.title like ? or b.author like ? or b.isbn like ? "
                              + "or b.category like ? or printf('B%04d', b.id) like ? "
                              + "order by lower(b.title)", q, q, q, q, q);
                        return WebHelper.json(WebHelper.map("books", books));
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
                Map<String, Object> book = DatabaseConnection.selectOne("select " + COLUMNS + " from books b where b.id = ?", id);
                if (book == null)
                        throw new WrongInputException("There is no book with id " + id + ".");
                return book;
        }

        private String details(int id) throws Exception
        {
                Map<String, Object> book = find(id);
                List<Map<String, Object>> history = DatabaseConnection.select(
                        "select l.*, m.first_name, m.last_name, printf('M%04d', m.id) as card "
                      + "from loans l join members m on m.id = l.member_id "
                      + "where l.book_id = ? order by l.issue_date desc, l.id desc", id);
                return WebHelper.json(WebHelper.map("book", book, "history", history));
        }

        private static List<Object> readForm(Map<String, String> p) throws WrongInputException
        {
                String isbn = optional(p, "isbn");
                if (isbn != null)
                        isbn = isbn.replace("-", "").replace(" ", "").toUpperCase();
                if (isbn != null && !isbn.matches("\\d{9}[\\dX]|\\d{13}"))
                        throw new WrongInputException("ISBN must have 10 or 13 digits.");
                List<Object> fields = new ArrayList<>();
                fields.add(required(p, "title", "Title"));
                fields.add(required(p, "author", "Author"));
                fields.add(optional(p, "category"));
                fields.add(optional(p, "publisher"));
                fields.add(number(p, "year", "Year", false, 1000, LocalDate.now().getYear()));
                fields.add(number(p, "pages", "Pages", false, 1, 100000));
                fields.add(isbn);
                fields.add(optional(p, "shelf"));
                fields.add(number(p, "copies", "Copies", true, 1, 1000));
                fields.add(optional(p, "description"));
                fields.add(optional(p, "notes"));
                return fields;
        }

        private String add(Map<String, String> p) throws Exception
        {
                List<Object> fields = readForm(p);
                fields.add(LocalDate.now().toString());
                DatabaseConnection.update("insert into books(title, author, category, publisher, year, pages, isbn, "
                           + "shelf, copies, description, notes, added) values(?,?,?,?,?,?,?,?,?,?,?,?)", fields.toArray());
                return WebHelper.json(WebHelper.map("ok", true, "id", DatabaseConnection.lastId()));
        }

        private String update(Map<String, String> p) throws Exception
        {
                int id = number(p, "id", "Book id", true, 1, Integer.MAX_VALUE);
                int outCount = intOf(find(id), "out_count");
                List<Object> fields = readForm(p);
                int copies = (Integer) fields.get(8);
                if (copies < outCount && outCount == 1)
                        throw new WrongInputException(outCount + " copy is out on loan, so Copies cannot be less than " + outCount + ".");
                if (copies < outCount)
                        throw new WrongInputException(outCount + " copies are out on loan, so Copies cannot be less than " + outCount + ".");
                fields.add(id);
                DatabaseConnection.update("update books set title=?, author=?, category=?, publisher=?, year=?, pages=?, "
                           + "isbn=?, shelf=?, copies=?, description=?, notes=? where id=?", fields.toArray());
                return WebHelper.json(WebHelper.map("ok", true, "id", id));
        }

        private String delete(Map<String, String> p) throws Exception
        {
                int id = number(p, "id", "Book id", true, 1, Integer.MAX_VALUE);
                int outCount = intOf(find(id), "out_count");
                if (outCount == 1)
                        throw new WrongInputException(outCount + " copy of this book is out on loan. Check it in before deleting the book.");
                if (outCount > 1)
                        throw new WrongInputException(outCount + " copies of this book are out on loan. Check them in before deleting the book.");
                DatabaseConnection.update("delete from loans where book_id = ?", id);
                DatabaseConnection.update("delete from books where id = ?", id);
                return WebHelper.json(WebHelper.map("ok", true));
        }
}
