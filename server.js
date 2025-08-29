// server.js

const express = require('express');
const mysql = require('mysql2');

const app = express();
const port = 3000;

// Database connection configuration
const db = mysql.createConnection({
    host: 'localhost',
    user: 'your_mysql_user', // Change to your MySQL username
    password: 'your_mysql_password', // Change to your MySQL password
    database: 'library_db' // We'll create this database next
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Successfully connected to MySQL database.');
});

// Middleware to parse JSON bodies
app.use(express.json());

// A simple test route
app.get('/', (req, res) => {
    res.send('Library Management System API is running!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});