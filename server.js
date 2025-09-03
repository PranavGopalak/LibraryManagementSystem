// server.js
require('dotenv').config();
const { Connector } = require("@google-cloud/cloud-sql-connector");
const mysql = require("mysql2/promise");
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(express.json());
app.use(cors());

// In-memory array for users (without passwords for now)
let users = [
    { id: 1, username: 'admin', role: 'admin' },
    { id: 2, username: 'patron', role: 'patron' }
];

// A simple test route
app.get('/', (req, res) => {
    res.send('Library Management System API is running!');
});


// Routes for Book Management (Admin Features)
// Fetches and returns a list of all books from the database
app.get('/api/books', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                title,
                author,
                isbn,
                description,
                page_count,
                available_copies AS copies
            FROM books
        `);
        res.json(rows);
    } catch (error) {
        console.error('Failed to fetch books:', error);
        res.status(500).send('Error fetching books from the database.');
    }
});

// Fetches and returns a single book by its unique ID
app.get('/api/books/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                title,
                author,
                isbn,
                description,
                page_count,
                available_copies AS copies
            FROM books
            WHERE id = ?
        `, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).send('Book not found.');
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Failed to fetch book:', error);
        res.status(500).send('Error fetching book from the database.');
    }
});

// Creates a new book record in the database
app.post('/api/books', async (req, res) => {
    try {
        const { title, author, isbn, description, page_count, copies } = req.body;
        const sql = `
            INSERT INTO books (title, author, isbn, description, page_count, total_copies, available_copies) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const initialTotal = Number(copies) || 0;
        const initialAvailable = Number(copies) || 0;
        const [result] = await pool.query(sql, [title, author, isbn, description, page_count, initialTotal, initialAvailable]);
        const newBook = { id: result.insertId, title, author, isbn, description, page_count, copies: initialAvailable };
        res.status(201).json(newBook);
    } catch (error) {
        console.error('Failed to add book:', error);
        res.status(500).send('Error adding book to the database.');
    }
});

// Updates the details of an existing book by its ID
app.put('/api/books/:id', async (req, res) => {
    try {
        const { title, author, isbn, description, page_count, copies } = req.body;
        const sql = `
            UPDATE books SET title = ?, author = ?, isbn = ?, description = ?, 
            page_count = ?, available_copies = ? 
            WHERE id = ?
        `;
        const newAvailable = Number(copies) || 0;
        const [result] = await pool.query(sql, [title, author, isbn, description, page_count, newAvailable, req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).send('Book not found.');
        }
        res.json({ id: parseInt(req.params.id), title, author, isbn, description, page_count, copies: newAvailable });
    } catch (error) {
        console.error('Failed to update book:', error);
        res.status(500).send('Error updating book in the database.');
    }
});

// Deletes a book from the database by its ID
app.delete('/api/books/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).send('Book not found.');
        }
        res.status(204).send(); // 204 No Content
    } catch (error) {
        console.error('Failed to delete book:', error);
        res.status(500).send('Error deleting book from the database.');
    }
});

app.get('/api/patron/checkouts/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        // Join active_checkouts with books to get book details
        const sql = `
            SELECT 
                ac.id AS id,
                ac.book_id AS bookId,
                ac.checkout_date AS checkoutDate,
                b.title,
                b.author
            FROM active_checkouts ac
            JOIN books b ON ac.book_id = b.id
            WHERE ac.user_id = ?
        `;
        const [checkouts] = await pool.query(sql, [userId]);
        res.json(checkouts);
    } catch (error) {
        console.error('Failed to fetch checkouts:', error);
        res.status(500).send('Error fetching checkouts from the database.');
    }
});

// Check out a book
app.post('/api/patron/checkout', async (req, res) => {
    const { userId, bookId } = req.body;
    const connection = await pool.getConnection(); // Get a connection from the pool for the transaction

    try {
        await connection.beginTransaction();

        // Ensure the user exists to satisfy FK constraint
        const [userRows] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).send('User not found.');
        }

        // Rule 1: Check if the user already has 3 or more books checked out.
        const [activeRows] = await connection.query('SELECT COUNT(*) as count FROM active_checkouts WHERE user_id = ?', [userId]);
        if (activeRows[0].count >= 3) {
            await connection.rollback();
            return res.status(400).send('Checkout limit reached. You may only check out up to 3 books.');
        }

        // Rule 2: Check if the user already has this specific book checked out.
        const [duplicateRows] = await connection.query('SELECT COUNT(*) as count FROM active_checkouts WHERE user_id = ? AND book_id = ?', [userId, bookId]);
        if (duplicateRows[0].count > 0) {
            await connection.rollback();
            return res.status(400).send('You may only check out 1 copy of a given book.');
        }

        // Rule 3: Check if a copy is available. Lock the row to prevent race conditions.
        const [bookRows] = await connection.query('SELECT available_copies FROM books WHERE id = ? FOR UPDATE', [bookId]);
        if (bookRows.length === 0 || bookRows[0].available_copies < 1) {
            await connection.rollback();
            return res.status(400).send('Book is not available for checkout.');
        }

        // All rules passed, proceed with checkout
        // 1. Decrease the available copies count
        await connection.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [bookId]);

        // 2. Add the record to active_checkouts
        const [result] = await connection.query(
            'INSERT INTO active_checkouts (user_id, book_id, checkout_date) VALUES (?, ?, NOW())',
            [userId, bookId]
        );

        await connection.commit(); // Finalize the transaction

        res.status(201).json({
            message: 'Book checked out successfully.',
            checkoutId: result.insertId
        });

    } catch (error) {
        await connection.rollback(); // Undo changes if anything went wrong
        console.error('Failed to checkout book:', error);
        res.status(500).send('An error occurred during the checkout process.');
    } finally {
        connection.release(); // Release the connection back to the pool
    }
});

// Return a book
app.post('/api/patron/return', async (req, res) => {
    const { userId, bookId } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Find the active checkout record. Lock the row.
        const [checkoutRows] = await connection.query('SELECT * FROM active_checkouts WHERE user_id = ? AND book_id = ? FOR UPDATE', [userId, bookId]);

        if (checkoutRows.length === 0) {
            await connection.rollback();
            return res.status(404).send('No active checkout found for this book and user.');
        }
        const checkoutRecord = checkoutRows[0];

        // 2. Insert the record into the history table
        await connection.query(
            'INSERT INTO checkout_history (user_id, book_id, checkout_date, return_date) VALUES (?, ?, ?, NOW())',
            [checkoutRecord.user_id, checkoutRecord.book_id, checkoutRecord.checkout_date]
        );

        // 3. Delete the record from the active checkouts table
        await connection.query('DELETE FROM active_checkouts WHERE id = ?', [checkoutRecord.id]);

        // 4. Increase the available copies count for the book
        await connection.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [bookId]);

        await connection.commit();

        res.status(200).json({ message: 'Book returned successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error('Failed to return book:', error);
        res.status(500).send('An error occurred during the return process.');
    } finally {
        connection.release();
    }
});

async function startServer() {
    try {
        const connector = new Connector();
        const clientOpts = await connector.getOptions({
            instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
            ipType: "PUBLIC",
        });

        pool = mysql.createPool({
            ...clientOpts,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        console.log("Successfully connected to the database!");


        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    } catch (error) {
        console.error("Failed to connect to the database:", error);
        process.exit(1); // Exit the process if the database connection fails
    }
}

startServer();