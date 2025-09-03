const { Connector } = require("@google-cloud/cloud-sql-connector");
const mysql = require("mysql2/promise");

async function testConnection() {
    const connector = new Connector();
    let pool;
    try {
        const clientOpts = await connector.getOptions({
            instanceConnectionName: "winter-clone-450202-b8:us-west1:pranavsql",
            ipType: "PUBLIC",
        });

        pool = mysql.createPool({
            ...clientOpts,
            user: "root",
            password: "Pranav@123",
            database: "library_db",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        const connection = await pool.getConnection();
        console.log("Successfully connected to the database!");

        // 2. CREATE A TABLE
        // await connection.query(`
        //     DROP TABLE checkouts;
        // `);

        // await connection.query(`
        //     CREATE TABLE IF NOT EXISTS users (
        //         id INT AUTO_INCREMENT PRIMARY KEY,
        //         username VARCHAR(255) NOT NULL UNIQUE,
        //         password VARCHAR(255) NOT NULL,
        //         role ENUM('admin', 'patron') NOT NULL
        //     );
        // `);
        //console.log("'users' table created successfully.");

        // await connection.query(`
        //     CREATE TABLE books (
        //         id INT AUTO_INCREMENT PRIMARY KEY,
        //         title VARCHAR(255) NOT NULL,
        //         author VARCHAR(255) NOT NULL,
        //         isbn VARCHAR(20) UNIQUE,
        //         description TEXT,
        //         page_count INT,
        //         total_copies INT NOT NULL,
        //         available_copies INT NOT NULL
        //     );
        // `);
        // console.log("'books' table created successfully.");

        // await connection.query(`
        //     CREATE TABLE active_checkouts (
        //         id INT AUTO_INCREMENT PRIMARY KEY,
        //         user_id INT NOT NULL,
        //         book_id INT NOT NULL,
        //         checkout_date DATETIME NOT NULL,
        //         FOREIGN KEY (user_id) REFERENCES users(id),
        //         FOREIGN KEY (book_id) REFERENCES books(id)
        //     );
        // `);
        // console.log("'checkouts' table created successfully.");

        // await connection.query(`
        //     CREATE TABLE checkout_history (
        //         id INT AUTO_INCREMENT PRIMARY KEY,
        //         user_id INT NOT NULL,
        //         book_id INT NOT NULL,
        //         checkout_date DATETIME NOT NULL,
        //         return_date DATETIME NOT NULL,
        //         FOREIGN KEY (user_id) REFERENCES users(id),
        //         FOREIGN KEY (book_id) REFERENCES books(id)
        //     );
        // `);
        // console.log("'checkouts' table created successfully.");

        // await connection.query(`
        //     INSERT INTO books (title, author, isbn, description, page_count, total_copies, available_copies) VALUES
        //         ('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'A novel about the serious issues of rape and racial inequality.', 324, 3, 3),
        //         ('1984', 'George Orwell', '9780451524935', 'A dystopian social science fiction novel and cautionary tale.', 328, 5, 5),
        //         ('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'A novel about the American dream.', 180, 4, 4),
        //         ('Pride and Prejudice', 'Jane Austen', '9780141439518', 'A romantic novel of manners.', 279, 2, 2),
        //         ('The Catcher in the Rye', 'J.D. Salinger', '9780316769488', 'A story about adolescent alienation and loss of innocence.', 224, 3, 3),
        //         ('The Hobbit', 'J.R.R. Tolkien', '9780547928227', 'A fantasy novel and prelude to The Lord of the Rings.', 310, 5, 5),
        //         ('Fahrenheit 451', 'Ray Bradbury', '9781451673319', 'A dystopian novel about a future American society where books are outlawed.', 158, 2, 2),
        //         ('Moby Dick', 'Herman Melville', '9781503280786', 'The saga of Captain Ahab and his relentless pursuit of the great white whale.', 635, 1, 1),
        //         ('War and Peace', 'Leo Tolstoy', '9781400079988', 'A novel that chronicles the history of the French invasion of Russia.', 1225, 1, 1),
        //         ('The Lord of the Rings', 'J.R.R. Tolkien', '9780618640157', 'A high-fantasy novel that is a sequel to The Hobbit.', 1178, 3, 3);
        // `);
        // console.log("'books' table populated successfully.");

        // await connection.query(`
        //     TRUNCATE TABLE active_checkouts;
        // `);

        // Step 1: Get all table names from the database
        console.log("\nFetching all tables from 'library_db'...");
        const [tableRows] = await connection.query('SHOW TABLES;');
        
        // Extract just the table names into a simple array
        const tables = tableRows.map(row => Object.values(row)[0]);
        console.log("Found tables:", tables.join(', '));

        // Step 2: Loop through each table and print its content
        for (const table of tables) {
            console.log(`\n--- Data from '${table}' ---`);
            const [dataRows] = await connection.query(`SELECT * FROM ${table}`);

            if (dataRows.length > 0) {
                console.table(dataRows);
            } else {
                console.log(`Table '${table}' is empty.`);
            }
        }

        // await connection.query(`
        //     INSERT INTO users (username, password, role) VALUES
        //         ('admin', 'admin', 'admin'),
        //         ('patron', 'patron', 'patron');
        // `);
        // console.log("'users' table populated successfully.");

        connection.release();

    } catch (error) {
        console.error("An error occurred:", error);
    } finally {
        if (pool) {
            pool.end();
        }
        connector.close();
    }
}

testConnection();