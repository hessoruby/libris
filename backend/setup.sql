create table if not exists users(uname text, pwd text);
insert into users select 'srm','ap' where not exists (select 1 from users where uname='srm');

create table if not exists books(
    id          integer primary key autoincrement,
    title       text    not null,
    author      text    not null,
    category    text,
    publisher   text,
    year        integer,
    pages       integer,
    isbn        text,
    shelf       text,
    copies      integer not null default 1,
    description text,
    notes       text,
    cover       text,
    added       text    not null default (date('now','localtime'))
);

create table if not exists members(
    id         integer primary key autoincrement,
    first_name text not null,
    last_name  text not null,
    ap_number  text not null unique,
    email      text,
    phone      text,
    joined     text not null default (date('now','localtime'))
);

create table if not exists loans(
    id          integer primary key autoincrement,
    book_id     integer not null references books(id),
    member_id   integer not null references members(id),
    issue_date  text    not null,
    due_date    text    not null,
    return_date text
);

insert into books(title, author, category, publisher, year, pages, isbn, shelf, copies, cover, description, added) values
('Operating System Concepts', 'Abraham Silberschatz', 'CSE 302 Operating Systems', 'Wiley', 2013, 919, '9781118063330', 'OS-01', 4, 'covers/9781118063330.jpg',
 'The standard OS textbook, also called the dinosaur book. Processes, threads, CPU scheduling, deadlocks, memory and file systems.', '2026-07-01'),
('Modern Operating Systems', 'Andrew S. Tanenbaum', 'CSE 302 Operating Systems', 'Pearson', 2015, 1136, '9780133591620', 'OS-02', 3, 'covers/9780133591620.jpg',
 'How operating systems work, with case studies of UNIX, Linux, Android and Windows.', '2026-07-01'),
('Operating Systems: Internals and Design Principles', 'William Stallings', 'CSE 302 Operating Systems', 'Pearson', 2017, 800, '9780134670959', 'OS-03', 2, 'covers/9780134670959.jpg',
 'Explains the design of modern operating systems: concurrency, memory management, scheduling and I/O.', '2026-07-02'),
('Machine Learning', 'Tom M. Mitchell', 'CSE 303 Machine Learning', 'McGraw-Hill', 1997, 432, '9780070428072', 'ML-01', 3, 'covers/9780070428072.jpg',
 'A classic introduction to machine learning: decision trees, neural networks, Bayesian learning and more.', '2026-07-05'),
('Pattern Recognition and Machine Learning', 'Christopher M. Bishop', 'CSE 303 Machine Learning', 'Springer', 2006, 738, '9780387310732', 'ML-02', 2, 'covers/9780387310732.jpg',
 'Machine learning explained with probability: regression, classification, kernels, graphical models.', '2026-07-05'),
('Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow', 'Aurelien Geron', 'CSE 303 Machine Learning', 'O''Reilly Media', 2019, 856, '9781492032649', 'ML-03', 2, 'covers/9781492032649.jpg',
 'Practical machine learning in Python, from linear regression to deep neural networks.', '2026-07-08'),
('Computer Organization and Design', 'David A. Patterson', 'CSE 305 Computer Organization and Architecture', 'Elsevier', 2014, 800, '9780124077263', 'COA-01', 3, 'covers/9780124077263.jpg',
 'The hardware and software interface: instructions, arithmetic, the processor, pipelining and memory.', '2026-07-10'),
('Computer Organization and Architecture', 'William Stallings', 'CSE 305 Computer Organization and Architecture', 'Pearson', 2015, 864, '9780134101613', 'COA-02', 3, 'covers/9780134101613.jpg',
 'Covers the structure and function of computers: CPU, memory, buses, I/O and parallel processing.', '2026-07-10'),
('Computer System Architecture', 'M. Morris Mano', 'CSE 305 Computer Organization and Architecture', 'Prentice Hall', 1993, 525, '9780131755635', 'COA-03', 2, 'covers/9780131755635.jpg',
 'From logic gates and registers to a complete basic computer, microprogramming and pipelining.', '2026-07-12'),
('Java: The Complete Reference', 'Herbert Schildt', 'CSE 309 Advanced Java Programming', 'McGraw-Hill', 2018, 1248, '9781260440232', 'JAVA-01', 4, 'covers/9781260440232.jpg',
 'Everything about the Java language and its libraries, with many short examples.', '2026-07-15'),
('Core Java, Volume II: Advanced Features', 'Cay S. Horstmann', 'CSE 309 Advanced Java Programming', 'Prentice Hall', 2019, 960, '9780135166314', 'JAVA-02', 3, 'covers/9780135166314.jpg',
 'Advanced Java topics: streams, input and output, networking, database programming with JDBC and more.', '2026-07-15'),
('Head First Java', 'Kathy Sierra', 'CSE 309 Advanced Java Programming', 'O''Reilly Media', 2005, 688, '9780596009205', 'JAVA-03', 2, 'covers/9780596009205.jpg',
 'A picture-heavy, beginner-friendly introduction to Java and object-oriented programming.', '2026-07-18'),
('Effective Java', 'Joshua Bloch', 'CSE 309 Advanced Java Programming', 'Addison-Wesley', 2017, 416, '9780134685991', 'JAVA-04', 2, 'covers/9780134685991.jpg',
 'Ninety items of advice on using the Java language and its libraries well.', '2026-07-18'),
('Textbook of Environmental Studies for Undergraduate Courses', 'Erach Bharucha', 'ENV 247 Natural Resources', 'Orient Blackswan', 2005, 289, '9788173715402', 'ENV-01', 3, 'covers/9788173715402.jpg',
 'The UGC textbook for environmental studies: natural resources, ecosystems, biodiversity and pollution.', '2026-07-20'),
('Natural Resource Conservation', 'Daniel D. Chiras', 'ENV 247 Natural Resources', 'Prentice Hall', 2004, 656, '9780131458321', 'ENV-02', 2, 'covers/9780131458321.jpg',
 'How to manage water, soil, forests, wildlife and energy for a sustainable future.', '2026-07-20'),
('Red Hat RHCSA 9 Cert Guide', 'Sander van Vugt', 'SEC 303 DevOps - RHCSA', 'Pearson', 2023, 704, '9780138096274', 'DEV-01', 2, 'covers/9780138096274.jpg',
 'Preparation for the EX200 exam: users, permissions, storage, networking, services and shell scripting on RHEL 9.', '2026-07-22'),
('The DevOps Handbook', 'Gene Kim', 'SEC 303 DevOps - RHCSA', 'IT Revolution Press', 2016, 437, '9781942788003', 'DEV-02', 1, 'covers/9781942788003.jpg',
 'How companies deliver software faster and more safely with flow, feedback and continual learning.', '2026-07-22');

insert into members(first_name, last_name, ap_number, joined) values
('Pranathi',       'N.',          'AP24110010392', '2026-07-01'),
('Sai Pravallika', 'G.',          'AP24110010383', '2026-07-03'),
('Satwik',         'Gupta',       'AP24110010470', '2026-07-20'),
('Harsh',          'Singh Rawat', 'AP24110010479', '2026-08-11'),
('Vyshnavi',       'K.S.V.S.',    'AP24110010432', '2026-09-02');

insert into loans(book_id, member_id, issue_date, due_date, return_date) values
(13, 1, date('now','localtime','-20 days'), date('now','localtime','-6 days'),  null),
(10, 1, date('now','localtime','-5 days'),  date('now','localtime','+9 days'),  null),
(1,  2, date('now','localtime','-3 days'),  date('now','localtime','+11 days'), null),
(4,  3, date('now','localtime','-30 days'), date('now','localtime','-16 days'), date('now','localtime','-18 days')),
(7,  4, date('now','localtime','-1 days'),  date('now','localtime','+13 days'), null);
