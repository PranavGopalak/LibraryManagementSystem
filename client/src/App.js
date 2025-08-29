// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

function App() {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    // Fetch books from the Express API (proxied in development)
    fetch('/api/books')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => setBooks(data))
      .catch(error => console.error("Could not fetch books:", error));
  }, []);

  return (
    <Container className="mt-5">
      <h1 className="text-center mb-4">Available Books</h1>
      <Row xs={1} md={2} lg={3} className="g-4">
        {books.map(book => (
          <Col key={book.id}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title>{book.title}</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">by {book.author}</Card.Subtitle>
                <Card.Text>
                  {book.description}
                </Card.Text>
              </Card.Body>
              <Card.Footer>
                <p>Copies Available: {book.copies}</p>
                <Button variant="primary">Check Out</Button>
              </Card.Footer>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
}

export default App;