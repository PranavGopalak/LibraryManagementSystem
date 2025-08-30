// server.js

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

let checkouts = [];  //TODO: Implement checkouts in Cloud SQL
// A simple array to store book data in memory
let books = [
    {
        id: 1,
        title: "The Hitchhiker's Guide to the Galaxy",
        author: "Douglas Adams",
        isbn: "978-0345391803",
        description: "A comedy science fiction series created by Douglas Adams.",
        page_count: 224,
        copies: 5
    },
    {
        id: 2,
        title: "Dune",
        author: "Frank Herbert",
        isbn: "978-0441172719",
        description: "A science fiction novel by American author Frank Herbert.",
        page_count: 412,
        copies: 3
    }
];

// In-memory array for users (without passwords for now)
let users = [
    { id: 1, username: 'admin', role: 'admin' },
    { id: 2, username: 'patron', role: 'patron' }
];

// A simple way to generate unique IDs
const generateId = (array) => {
    const maxId = array.length > 0 ? Math.max(...array.map(item => item.id)) : 0;
    return maxId + 1;
};

// A simple test route
app.get('/', (req, res) => {
    res.send('Library Management System API is running!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Routes for Book Management (Admin Features)
// Add a new book
app.post('/api/books', (req, res) => {
    // You'll need to add logic here to check for an admin role
    const newBook = {
        id: generateId(books),
        title: req.body.title,
        author: req.body.author,
        isbn: req.body.isbn,
        description: req.body.description,
        page_count: req.body.page_count,
        copies: req.body.copies
    };
    books.push(newBook);
    res.status(201).json(newBook);
});

// Get all books
app.get('/api/books', (req, res) => {
    res.json(books);
});

// Get a single book
app.get('/api/books/:id', (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    if (!book) {
        return res.status(404).send('Book not found.');
    }
    res.json(book);
});

// Edit an existing book
app.put('/api/books/:id', (req, res) => {
    const bookIndex = books.findIndex(b => b.id === parseInt(req.params.id));
    if (bookIndex === -1) {
        return res.status(404).send('Book not found.');
    }
    const updatedBook = { ...books[bookIndex], ...req.body };
    books[bookIndex] = updatedBook;
    res.json(updatedBook);
});

// Remove a book
app.delete('/api/books/:id', (req, res) => {
    const bookIndex = books.findIndex(b => b.id === parseInt(req.params.id));
    if (bookIndex === -1) {
        return res.status(404).send('Book not found.');
    }
    books.splice(bookIndex, 1);
    res.status(204).send(); // 204 No Content
});

// Routes for Patron Features
// View currently checked-out books
app.get('/api/patron/checkouts/:userId', (req, res) => {
    // You'll need to add logic here to ensure the user is logged in
    const userId = parseInt(req.params.userId);
    const userCheckouts = checkouts.filter(c => c.userId === userId);
    res.json(userCheckouts);
});

// Check out a book
app.post('/api/patron/checkout', (req, res) => {
    // This is the core logic, which we'll need to expand on
    // to check for the checkout rules (max 3 books, 1 copy per book)
    const { userId, bookId } = req.body;

    // Consider only active (unreturned) checkouts for rules
    const patronCheckouts = checkouts.filter(c => c.userId === userId && !c.returnDate);
    const book = books.find(b => b.id === bookId);

    // Rule 1: A Patron may have at most 3 active checkouts at once.
    if (patronCheckouts.length >= 3) {
        return res.status(400).send('Checkout limit reached. You may only check out up to 3 books.');
    }

    // Rule 2: A Patron may only check out 1 copy of a given book at a time.
    if (patronCheckouts.some(c => c.bookId === bookId)) {
        return res.status(400).send('You may only check out 1 copy of a given book.');
    }

    // Check if the book and a copy are available
    if (!book || book.copies < 1) {
        return res.status(400).send('Book is not available for checkout.');
    }

    // Create the checkout record
    const newCheckout = {
        id: generateId(checkouts),
        userId,
        bookId,
        checkoutDate: new Date().toISOString(),
        returnDate: null // Null until the book is returned
    };
    checkouts.push(newCheckout);

    // Decrease the number of available copies
    book.copies--;

    res.status(201).json(newCheckout);
});

// Return a book
app.post('/api/patron/return', (req, res) => {
    const { userId, bookId } = req.body;

    const checkoutIndex = checkouts.findIndex(c => c.userId === userId && c.bookId === bookId && !c.returnDate);

    if (checkoutIndex === -1) {
        return res.status(404).send('No active checkout found for this book and user.');
    }

    const checkoutRecord = checkouts[checkoutIndex];
    checkoutRecord.returnDate = new Date().toISOString();

    // Increase the number of available copies
    const book = books.find(b => b.id === bookId);
    if (book) {
        book.copies++;
    }

    res.status(200).json(checkoutRecord);
});