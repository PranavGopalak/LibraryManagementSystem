// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import { Navbar, Container, Row, Col, Card, Button, Nav, Dropdown, Form } from 'react-bootstrap';

function App() {
  const [books, setBooks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('auth') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('auth', 'true');
      setIsAuthed(true);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setIsAuthed(false);
    setUsername('');
    setPassword('');
  };

  return (
    <>
      <Navbar bg={darkMode ? 'dark' : 'light'} data-bs-theme={darkMode ? 'dark' : 'light'} expand="md" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-semibold">Chico Library</Navbar.Brand>
          <Nav className="ms-auto align-items-center">
            <Dropdown align="end">
              <Dropdown.Toggle variant={darkMode ? 'outline-light' : 'outline-dark'} id="settings-dropdown">
                <i className="bi bi-gear me-2"></i>Settings
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => setDarkMode(v => !v)}>
                  {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Container>
      </Navbar>
      <Container className="mt-4">
        {!isAuthed ? (
          <Row className="justify-content-center">
            <Col xs={12} sm={10} md={8} lg={6} xl={5}>
              <Card className="p-3 p-md-4">
                <h3 className="mb-3 text-center">Sign in</h3>
                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3" controlId="username">
                    <Form.Label>Email or Username</Form.Label>
                    <Form.Control type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="password">
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin" required />
                  </Form.Group>
                  {loginError && <div className="text-danger mb-2">{loginError}</div>}
                  <div className="d-grid">
                    <Button type="submit" variant="primary">Login</Button>
                  </div>
                </Form>
              </Card>
            </Col>
          </Row>
        ) : (
          <>
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
          </>
        )}
      </Container>
    </>
  );
}

export default App;