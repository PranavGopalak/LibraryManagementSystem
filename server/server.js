// server.js
require('dotenv').config();
const { Connector } = require("@google-cloud/cloud-sql-connector");
const mysql = require("mysql2/promise");
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// IMPORTANT: Cloud Run sets PORT automatically (usually 8080).
// Locally, it falls back to 3001.
const PORT = process.env.PORT || 3001;

// Single shared pool variable for all routes
let pool;

app.use(express.json());
app.use(cors());

// Basic request logger for debugging
app.use((req, res, next) => {
    console.log('[REQ]', req.method, req.path);
    next();
});

// In-memory array for users (without passwords for now)
let users = [
    { id: 1, username: 'admin', role: 'admin' },
    { id: 2, username: 'patron', role: 'patron' }
];

// A simple test route
app.get('/', (req, res) => {
    res.send('Library Management System API is running!');
});

// Auth helpers and middleware
function generateJwtToken(user) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not set');
    }
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

async function initializeSchema() {
    const createUsersTableSql = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin','patron') NOT NULL DEFAULT 'patron',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_users_username (username),
            INDEX idx_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(createUsersTableSql);

    // If a legacy users table exists without new columns, add them safely
    try {
        const [cols] = await pool.query(
            `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users'`,
            [process.env.DB_NAME]
        );
        const have = new Set(cols.map(c => c.name));
        const alterStatements = [];
        if (!have.has('email')) alterStatements.push(`ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL`);
        if (!have.has('password_hash')) alterStatements.push(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL`);
        if (!have.has('role')) alterStatements.push(`ALTER TABLE users ADD COLUMN role ENUM('admin','patron') NOT NULL DEFAULT 'patron'`);
        if (!have.has('created_at')) alterStatements.push(`ALTER TABLE users ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`);
        for (const stmt of alterStatements) await pool.query(stmt);

        // Ensure indexes (skip if already exist)
        const [idx] = await pool.query(
            `SELECT index_name FROM information_schema.statistics WHERE table_schema = ? AND table_name = 'users'`,
            [process.env.DB_NAME]
        );
        const existingIdx = new Set(idx.map(i => i.index_name));
        if (!existingIdx.has('idx_users_username')) {
            try { await pool.query(`CREATE INDEX idx_users_username ON users (username)`); } catch (_) { }
        }
        if (!existingIdx.has('idx_users_email') && have.has('email')) {
            try { await pool.query(`CREATE INDEX idx_users_email ON users (email)`); } catch (_) { }
        }
    } catch (e) {
        console.warn('Users table migration skipped or partially applied:', e.message || e);
    }
}

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
    let connection;
    try {
        const { username, email, password, role: requestedRole, adminInviteCode } = req.body || {};
        console.log('[AUTH][SIGNUP] payload received', {
            username,
            emailPresent: typeof email === 'string',
            passwordLength: typeof password === 'string' ? password.length : undefined,
            requestedRole: requestedRole || 'patron'
        });
        const usernameValid = typeof username === 'string' && /^[A-Za-z0-9_]{3,30}$/.test(username);
        const emailValid = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const passwordValid = typeof password === 'string' && password.length >= 8;
        if (!usernameValid || !emailValid || !passwordValid) {
            console.warn('[AUTH][SIGNUP] validation failed', { usernameValid, emailValid, passwordValid });
            return res.status(400).json({ message: 'Invalid input', details: { usernameValid, emailValid, passwordValid } });
        }

        // Determine final role with security check for admin
        let finalRole = 'patron';
        if (requestedRole === 'admin') {
            const requiredCode = process.env.ADMIN_INVITE_CODE;
            if (!requiredCode) {
                console.warn('[AUTH][SIGNUP] admin signup requested but ADMIN_INVITE_CODE is not set');
                return res.status(403).json({ message: 'Admin signup is disabled.' });
            }
            if (adminInviteCode !== requiredCode) {
                console.warn('[AUTH][SIGNUP] invalid admin invite code');
                return res.status(403).json({ message: 'Invalid admin invite code.' });
            }
            finalRole = 'admin';
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const passwordHash = await bcrypt.hash(password, 12);
        console.log('[AUTH][SIGNUP] password hashed');
        const insertSql = `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`;
        const [result] = await connection.query(insertSql, [username, email, passwordHash, finalRole]);
        console.log('[AUTH][SIGNUP] user inserted (tx)', { insertId: result.insertId });
        const newUser = { id: result.insertId, username, email, role: finalRole };

        // Generate token before committing to ensure we don't keep a row if token creation fails
        const token = generateJwtToken(newUser);
        console.log('[AUTH][SIGNUP] token generated');

        await connection.commit();
        return res.status(201).json({ user: newUser, token });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) { }
        }
        if (error && error.code === 'ER_DUP_ENTRY') {
            console.warn('[AUTH][SIGNUP] duplicate entry');
            return res.status(409).json({ message: 'Username or email already in use' });
        }
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
            console.error('[AUTH][SIGNUP] schema mismatch (missing column?)', error);
            return res.status(500).json({ message: 'Users table schema is outdated. Restart server to run migrations or update schema.', code: error.code });
        }
        if (error && error.message === 'JWT_SECRET is not set') {
            console.error('[AUTH][SIGNUP] JWT secret missing');
            return res.status(500).json({ message: 'Server auth not configured. Set JWT_SECRET and restart.' });
        }
        console.error('[AUTH][SIGNUP] failed:', error);
        return res.status(500).json({ message: 'Error creating user' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body || {};
        console.log('[AUTH][LOGIN] payload received', { usernameOrEmailPresent: typeof usernameOrEmail === 'string', passwordLength: typeof password === 'string' ? password.length : undefined });
        if (typeof usernameOrEmail !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Invalid input' });
        }
        const selectSql = `SELECT id, username, email, password_hash, role FROM users WHERE username = ? OR email = ? LIMIT 1`;
        const [rows] = await pool.query(selectSql, [usernameOrEmail, usernameOrEmail]);
        if (!rows || rows.length === 0) {
            console.warn('[AUTH][LOGIN] user not found');
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const userRow = rows[0];
        const match = await bcrypt.compare(password, userRow.password_hash);
        if (!match) {
            console.warn('[AUTH][LOGIN] password mismatch');
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = { id: userRow.id, username: userRow.username, email: userRow.email, role: userRow.role };
        const token = generateJwtToken(user);
        console.log('[AUTH][LOGIN] success', { userId: user.id });
        return res.status(200).json({ user, token });
    } catch (error) {
        console.error('[AUTH][LOGIN] failed:', error);
        return res.status(500).json({ message: 'Error logging in' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, username, email, role, created_at FROM users WHERE id = ?`, [req.user.id]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json({ user: rows[0] });
    } catch (error) {
        console.error('Failed to fetch current user:', error);
        return res.status(500).json({ message: 'Error fetching user' });
    }
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

        // Query active checkouts
        const activeSql = `
            SELECT
                ac.id AS id,
                ac.book_id AS bookId,
                ac.checkout_date AS checkoutDate,
                NULL AS returnDate,
                b.title,
                b.author
            FROM active_checkouts ac
            JOIN books b ON ac.book_id = b.id
            WHERE ac.user_id = ?
        `;

        // Query returned checkouts from history
        const historySql = `
            SELECT
                ch.id AS id,
                ch.book_id AS bookId,
                ch.checkout_date AS checkoutDate,
                ch.return_date AS returnDate,
                b.title,
                b.author
            FROM checkout_history ch
            JOIN books b ON ch.book_id = b.id
            WHERE ch.user_id = ?
        `;

        const [activeCheckouts] = await pool.query(activeSql, [userId]);
        const [returnedCheckouts] = await pool.query(historySql, [userId]);

        // Combine both active and returned checkouts
        const allCheckouts = [...activeCheckouts, ...returnedCheckouts];

        console.log(`User ${userId} checkouts - Active: ${activeCheckouts.length}, Returned: ${returnedCheckouts.length}`);

        res.json(allCheckouts);
    } catch (error) {
        console.error('Failed to fetch checkouts:', error);
        res.status(500).send('Error fetching checkouts from the database.');
    }
});

// Check out a book
app.post('/api/patron/checkout', authenticateToken, async (req, res) => {
    const { bookId } = req.body || {};
    const userId = req.user && req.user.id;
    const connection = await pool.getConnection();

    try {
        if (!Number.isFinite(Number(bookId)) || Number(bookId) <= 0) {
            return res.status(400).json({ message: 'Invalid bookId' });
        }

        await connection.beginTransaction();

        // Ensure the user exists to satisfy FK constraint
        const [userRows] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found' });
        }

        // Rule 1: Check if the user already has 3 or more books checked out.
        const [activeRows] = await connection.query('SELECT COUNT(*) as count FROM active_checkouts WHERE user_id = ?', [userId]);
        if (activeRows[0].count >= 3) {
            await connection.rollback();
            return res.status(400).json({ message: 'Checkout limit reached. You may only check out up to 3 books.' });
        }

        // Rule 2: Check if the user already has this specific book checked out.
        const [duplicateRows] = await connection.query('SELECT COUNT(*) as count FROM active_checkouts WHERE user_id = ? AND book_id = ?', [userId, bookId]);
        if (duplicateRows[0].count > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'You may only check out 1 copy of a given book.' });
        }

        // Rule 3: Check if a copy is available. Lock the row to prevent race conditions.
        const [bookRows] = await connection.query('SELECT available_copies FROM books WHERE id = ? FOR UPDATE', [bookId]);
        if (bookRows.length === 0 || bookRows[0].available_copies < 1) {
            await connection.rollback();
            return res.status(400).json({ message: 'Book is not available for checkout.' });
        }

        // All rules passed, proceed with checkout
        // 1. Decrease the available copies count
        await connection.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [bookId]);

        // 2. Add the record to active_checkouts
        const [result] = await connection.query(
            'INSERT INTO active_checkouts (user_id, book_id, checkout_date) VALUES (?, ?, NOW())',
            [userId, bookId]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Book checked out successfully.',
            checkoutId: result.insertId
        });

    } catch (error) {
        try { await connection.rollback(); } catch (_) { }
        console.error('Failed to checkout book:', error);
        res.status(500).json({ message: 'An error occurred during the checkout process.' });
    } finally {
        connection.release();
    }
});

// Return a book
app.post('/api/patron/return', authenticateToken, async (req, res) => {
    const { bookId } = req.body || {};
    const userId = req.user && req.user.id;
    const connection = await pool.getConnection();

    try {
        if (!Number.isFinite(Number(bookId)) || Number(bookId) <= 0) {
            return res.status(400).json({ message: 'Invalid bookId' });
        }

        await connection.beginTransaction();

        // 1. Find the active checkout record. Lock the row.
        const [checkoutRows] = await connection.query('SELECT * FROM active_checkouts WHERE user_id = ? AND book_id = ? FOR UPDATE', [userId, bookId]);

        if (checkoutRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No active checkout found for this book and user.' });
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
        try { await connection.rollback(); } catch (_) { }
        console.error('Failed to return book:', error);
        res.status(500).json({ message: 'An error occurred during the return process.' });
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

        // Initialize schema
        await initializeSchema();


        // IMPORTANT: listen on PORT and 0.0.0.0 for Cloud Run
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to connect to the database:", error);
        process.exit(1); // Exit the process if the database connection fails
    }
}

startServer();