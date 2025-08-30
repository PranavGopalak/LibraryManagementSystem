// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import { Navbar, Container, Row, Col, Card, Button, Nav, Dropdown, Form, InputGroup, Badge, Modal } from 'react-bootstrap';


function App() {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('auth') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [accountType, setAccountType] = useState(() => localStorage.getItem('accountType') || '');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    page_count: 0,
    copies: 1
  });

  useEffect(() => {
    // Fetch books from the Express API (proxied in development)
    setIsLoading(true);
    fetch('/api/books')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setBooks(data);
        setFilteredBooks(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Could not fetch books:", error);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Filter books based on search term and genre
  useEffect(() => {
    let filtered = books;

    if (searchTerm) {
      filtered = filtered.filter(book =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedGenre !== 'all') {
      filtered = filtered.filter(book => book.genre === selectedGenre);
    }

    setFilteredBooks(filtered);
  }, [searchTerm, selectedGenre, books]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('auth', 'true');
      localStorage.setItem('accountType', 'admin');
      setIsAuthed(true);
      setAccountType('admin');
      setLoginError('');
    } else if (username === 'patron' && password === 'patron') {
      localStorage.setItem('auth', 'true');
      localStorage.setItem('accountType', 'patron');
      setIsAuthed(true);
      setAccountType('patron');
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    if (username && password) {
      localStorage.setItem('auth', 'true');
      localStorage.setItem('accountType', 'patron');
      setIsAuthed(true);
      setAccountType('patron');
      setLoginError('');
    } else {
      setLoginError('Please fill out all fields');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('accountType');
    setIsAuthed(false);
    setUsername('');
    setPassword('');
    setSearchTerm('');
    setSelectedGenre('all');
    setAccountType('');
  };

  const handleCheckout = (bookId) => {
    // Mock checkout functionality
    console.log(`Checking out book ${bookId}`);
    // Here you would typically make an API call
  };

  const handleEditBook = (book) => {
    setEditingBook(book);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    // Mock save functionality - in real app, this would make an API call
    const updatedBooks = books.map(book =>
      book.id === editingBook.id ? editingBook : book
    );
    setBooks(updatedBooks);
    setFilteredBooks(updatedBooks);
    setShowEditModal(false);
    setEditingBook(null);
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingBook(null);
  };

  const handleOpenAdd = () => {
    setNewBook({ title: '', author: '', isbn: '', description: '', page_count: 0, copies: 1 });
    setShowAddModal(true);
  };

  const handleCloseAdd = () => {
    setShowAddModal(false);
  };

  const handleCreateBook = async () => {
    try {
      const payload = {
        title: newBook.title?.trim(),
        author: newBook.author?.trim(),
        isbn: newBook.isbn?.trim(),
        description: newBook.description?.trim(),
        page_count: Number(newBook.page_count) || 0,
        copies: Number(newBook.copies) || 0,
      };

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error('Failed to create book');
      }
      const created = await res.json();
      const updated = [created, ...books];
      setBooks(updated);
      setFilteredBooks(updated);
      setShowAddModal(false);
      setNewBook({ title: '', author: '', isbn: '', description: '', page_count: 0, copies: 1 });
    } catch (err) {
      console.error('Create book error:', err);
      // Optionally surface an alert/toast in future
    }
  };

  const getAvailabilityColor = (copies) => {
    if (copies === 0) return 'danger';
    if (copies <= 2) return 'warning';
    return 'success';
  };

  const getAvailabilityText = (copies) => {
    if (copies === 0) return 'Out of Stock';
    if (copies <= 2) return 'Low Stock';
    return 'Available';
  };

  // Mock genres for demonstration
  const genres = ['all', 'Science Fiction', 'Fantasy', 'Mystery', 'Romance', 'Non-Fiction'];

  const renderBookCard = (book) => (
    <Col key={book.id} xs={12} sm={6} lg={4} xl={3}>
      <Card className="h-100 book-card">
        {accountType === 'admin' && (
          <div className="book-actions">
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="book-action-toggle" no-caret>
                <i className="bi bi-three-dots-vertical"></i>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleEditBook(book)}>
                  <i className="bi bi-pencil me-2"></i>
                  Edit Book
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )}
        <Card.Body className="d-flex flex-column">
          <Card.Title className="book-title">{book.title}</Card.Title>
          <Card.Subtitle className="book-author mb-3">
            <i className="bi bi-person me-2"></i>
            {book.author}
          </Card.Subtitle>
          <Card.Text className="book-description flex-grow-1">
            {book.description.length > 120
              ? `${book.description.substring(0, 120)}...`
              : book.description
            }
          </Card.Text>
          <div className="book-meta mb-3">
            <Badge bg="secondary" className="me-2">
              <i className="bi bi-file-text me-1"></i>
              {book.page_count || 'Unknown'} pages
            </Badge>
            <Badge bg="info">
              <i className="bi bi-upc-scan me-1"></i>
              {book.isbn}
            </Badge>
          </div>
        </Card.Body>
        <Card.Footer className="book-footer">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="availability-info">
              <Badge bg={getAvailabilityColor(book.copies)} className="me-2">
                {getAvailabilityText(book.copies)}
              </Badge>
              <small className="text-muted">
                {book.copies} {book.copies === 1 ? 'copy' : 'copies'} available
              </small>
            </div>
          </div>
          <div className="d-grid">
            <Button
              variant="primary"
              onClick={() => handleCheckout(book.id)}
              disabled={book.copies === 0}
              className="checkout-btn"
            >
              <i className="bi bi-cart-plus me-2"></i>
              {book.copies === 0 ? 'Out of Stock' : 'Check Out'}
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </Col>
  );

  const renderSearchAndFilters = () => (
    <div className="search-filters-section mb-5">
      <Row className="g-3">
        <Col xs={12} md={8}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search books by title, author, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </InputGroup>
        </Col>
        <Col xs={12} md={4}>
          <Form.Select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="genre-select"
          >
            {genres.map(genre => (
              <option key={genre} value={genre}>
                {genre === 'all' ? 'All Genres' : genre}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {searchTerm && (
        <div className="search-results-info mt-3">
          <p className="text-muted mb-0">
            Found {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''}
            {searchTerm && ` for "${searchTerm}"`}
          </p>
        </div>
      )}
    </div>
  );

  const renderStats = () => (
    <div className="stats-section mb-5">
      <Row className="g-3">
        <Col xs={12} sm={4}>
          <Card className="stat-card text-center">
            <Card.Body>
              <div className="stat-icon mb-2">
                <i className="bi bi-book text-primary" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="stat-number">{books.length}</h4>
              <p className="stat-label text-muted mb-0">Total Books</p>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="stat-card text-center">
            <Card.Body>
              <div className="stat-icon mb-2">
                <i className="bi bi-check-circle text-success" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="stat-number">{books.filter(b => b.copies > 0).length}</h4>
              <p className="stat-label text-muted mb-0">Available</p>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card className="stat-card text-center">
            <Card.Body>
              <div className="stat-icon mb-2">
                <i className="bi bi-x-circle text-danger" style={{ fontSize: '2rem' }}></i>
              </div>
              <h4 className="stat-number">{books.filter(b => b.copies === 0).length}</h4>
              <p className="stat-label text-muted mb-0">Out of Stock</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderLoadingState = () => (
    <Row className="g-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Col key={i} xs={12} sm={6} lg={4} xl={3}>
          <Card className="h-100">
            <div className="skeleton" style={{ height: '200px' }}></div>
            <Card.Body>
              <div className="skeleton" style={{ height: '24px', width: '80%', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ height: '16px', width: '60%', marginBottom: '16px' }}></div>
              <div className="skeleton" style={{ height: '16px', width: '100%', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ height: '16px', width: '90%' }}></div>
            </Card.Body>
            <Card.Footer>
              <div className="skeleton" style={{ height: '40px', width: '100%' }}></div>
            </Card.Footer>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderEmptyState = () => (
    <div className="empty-state text-center py-5">
      <div className="empty-state-icon mb-4">
        <i className="bi bi-search text-muted" style={{ fontSize: '4rem' }}></i>
      </div>
      <h3 className="empty-state-title mb-3">No books found</h3>
      <p className="empty-state-description text-muted mb-4">
        {searchTerm
          ? `No books match your search for "${searchTerm}". Try adjusting your search terms or filters.`
          : 'No books are currently available. Please check back later.'
        }
      </p>
      {searchTerm && (
        <Button
          variant="outline-primary"
          onClick={() => {
            setSearchTerm('');
            setSelectedGenre('all');
          }}
        >
          <i className="bi bi-arrow-clockwise me-2"></i>
          Clear Search
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Navbar bg={darkMode ? 'dark' : 'light'} data-bs-theme={darkMode ? 'dark' : 'light'} expand="md" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-semibold">
            <i className="bi bi-building me-2"></i>
            Chico Library
          </Navbar.Brand>
          <Nav className="ms-auto align-items-center">
            <Dropdown align="end">
              <Dropdown.Toggle variant={darkMode ? 'outline-light' : 'outline-dark'} id="settings-dropdown">
                <i className="bi bi-gear me-2"></i>Settings
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => setDarkMode(v => !v)}>
                  <i className={`bi ${darkMode ? 'bi-sun' : 'bi-moon'} me-2`}></i>
                  {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Container>
      </Navbar>

      <Container className="mt-4 pb-5">
        {!isAuthed ? (
          <Row className="justify-content-center">
            <Col xs={12} sm={10} md={8} lg={6} xl={5}>
              <Card className="p-3 p-md-4 auth-card">
                <div className="text-center mb-4">
                  <div className="auth-icon mb-3">
                    <i className="bi bi-shield-lock text-primary" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <h3 className="auth-title">{isSignup ? 'Create Account' : 'Welcome Back'}</h3>
                  <p className="text-muted">{isSignup ? 'Join our library community' : 'Sign in to your account'}</p>
                </div>

                <Form onSubmit={isSignup ? handleSignup : handleLogin}>
                  <Form.Group className="mb-3" controlId="username">
                    <Form.Label>Email or Username</Form.Label>
                    <Form.Control
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isSignup ? "Choose a username" : "admin"}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="password">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignup ? "Create a password" : "admin"}
                      required
                    />
                  </Form.Group>
                  {loginError && (
                    <div className="alert alert-danger py-2 mb-3">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {loginError}
                    </div>
                  )}
                  <div className="d-grid mb-3">
                    <Button type="submit" variant="primary" size="lg">
                      <i className={`bi ${isSignup ? 'bi-person-plus' : 'bi-box-arrow-in-right'} me-2`}></i>
                      {isSignup ? 'Create Account' : 'Sign In'}
                    </Button>
                  </div>
                </Form>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsSignup(v => !v);
                      setLoginError('');
                    }}
                    className="text-decoration-none"
                  >
                    {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <>
            <div className="page-header mb-5">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h1 className="page-title">Library Collection</h1>
                  <p className="page-subtitle text-muted">
                    Discover and explore our vast collection of books
                  </p>
                </div>
                <div className="page-actions">
                  <Badge bg="primary" className="fs-6 px-3 py-2">
                    <i className="bi bi-person-circle me-2"></i>
                    Welcome {accountType}, {username || 'User'}
                  </Badge>
                </div>
              </div>
            </div>

            {renderStats()}
            {renderSearchAndFilters()}

            {isLoading ? (
              renderLoadingState()
            ) : filteredBooks.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <div className="books-grid-header mb-4 d-flex justify-content-between align-items-center">
                  <div>
                    <h2 className="h4 mb-0">Available Books</h2>
                    <p className="text-muted mb-0">
                      Showing {filteredBooks.length} of {books.length} books
                    </p>
                  </div>
                  {accountType === 'admin' && (
                    <Button variant="success" onClick={handleOpenAdd}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Add Book
                    </Button>
                  )}
                </div>
                <Row xs={1} sm={2} lg={3} xl={4} className="g-4">
                  {filteredBooks.map(renderBookCard)}
                </Row>
              </>
            )}
          </>
        )}
      </Container>
      {/* Edit Book Modal */}
      <Modal show={showEditModal} onHide={handleCancelEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Book</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingBook && (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Title</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingBook.title}
                      onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Author</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingBook.author}
                      onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingBook.description}
                  onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })}
                />
              </Form.Group>
              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>ISBN</Form.Label>
                    <Form.Control
                      type="text"
                      value={editingBook.isbn}
                      onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Page Count</Form.Label>
                    <Form.Control
                      type="number"
                      value={editingBook.page_count}
                      onChange={(e) => setEditingBook({ ...editingBook, page_count: parseInt(e.target.value) })}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Available Copies</Form.Label>
                    <Form.Control
                      type="number"
                      value={editingBook.copies}
                      onChange={(e) => setEditingBook({ ...editingBook, copies: parseInt(e.target.value) })}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Book Modal */}
      <Modal show={showAddModal} onHide={handleCloseAdd} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Book</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    type="text"
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Author</Form.Label>
                  <Form.Control
                    type="text"
                    value={newBook.author}
                    onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={newBook.description}
                onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
              />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>ISBN</Form.Label>
                  <Form.Control
                    type="text"
                    value={newBook.isbn}
                    onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Page Count</Form.Label>
                  <Form.Control
                    type="number"
                    value={newBook.page_count}
                    onChange={(e) => setNewBook({ ...newBook, page_count: parseInt(e.target.value) || 0 })}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Available Copies</Form.Label>
                  <Form.Control
                    type="number"
                    value={newBook.copies}
                    onChange={(e) => setNewBook({ ...newBook, copies: parseInt(e.target.value) || 0 })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseAdd}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleCreateBook}>
            Create Book
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default App;