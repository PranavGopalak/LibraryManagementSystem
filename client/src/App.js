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
  const [checkoutBag, setCheckoutBag] = useState([]);
  const [showBagModal, setShowBagModal] = useState(false);
  const [patronActiveCheckouts, setPatronActiveCheckouts] = useState([]);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnBookId, setReturnBookId] = useState(null);

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

  useEffect(() => {
    const fetchPatronCheckouts = async () => {
      if (accountType === 'patron' && isAuthed) {
        try {
          const userId = 2; // placeholder for patron
          const res = await fetch(`/api/patron/checkouts/${userId}`);
          if (res.ok) {
            const data = await res.json();
            setPatronActiveCheckouts(data.filter(c => !c.returnDate));
          }
        } catch (e) {
          console.error('Failed to fetch patron checkouts', e);
        }
      } else {
        setPatronActiveCheckouts([]);
      }
    };
    fetchPatronCheckouts();
  }, [accountType, isAuthed]);

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

  const getBookTitleById = (id) => {
    const found = books.find(b => b.id === id);
    return found ? found.title : '';
  };

  const getBookAuthorById = (id) => {
    const found = books.find(b => b.id === id);
    return found ? found.author : '';
  };

  const getCheckoutDateByBookId = (bookId) => {
    const found = patronActiveCheckouts.find(c => c.bookId === bookId);
    return found ? new Date(found.checkoutDate).toLocaleDateString() : null;
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
            {accountType === 'patron' ? (
              <Button
                variant="primary"
                onClick={() => addToBag(book)}
                disabled={
                  book.copies === 0 ||
                  checkoutBag.some(b => b.id === book.id) ||
                  patronActiveCheckouts.some(c => c.bookId === book.id) ||
                  (checkoutBag.length >= Math.max(0, 3 - patronActiveCheckouts.length))
                }
                className="checkout-btn"
              >
                <i className="bi bi-bag-plus me-2"></i>
                {patronActiveCheckouts.some(c => c.bookId === book.id)
                  ? 'Already Checked Out'
                  : checkoutBag.some(b => b.id === book.id)
                    ? 'In Bag'
                    : book.copies === 0
                      ? 'Out of Stock'
                      : (checkoutBag.length >= Math.max(0, 3 - patronActiveCheckouts.length))
                        ? 'Limit Reached'
                        : 'Add to Bag'}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => handleCheckout(book.id)}
                disabled={book.copies === 0}
                className="checkout-btn"
              >
                <i className="bi bi-cart-plus me-2"></i>
                {book.copies === 0 ? 'Out of Stock' : 'Check Out'}
              </Button>
            )}
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

  const openBag = () => setShowBagModal(true);
  const closeBag = () => setShowBagModal(false);

  const addToBag = (book) => {
    if (accountType !== 'patron') return;
    const remainingSlots = Math.max(0, 3 - patronActiveCheckouts.length);
    if (remainingSlots <= 0) {
      alert('You have reached your checkout limit of 3 books.');
      return;
    }
    if (checkoutBag.length >= remainingSlots) {
      alert(`You can add at most ${remainingSlots} more book${remainingSlots === 1 ? '' : 's'} to your bag.`);
      return;
    }
    if (checkoutBag.some(b => b.id === book.id)) {
      alert('You can only check out 1 copy of each book.');
      return;
    }
    setCheckoutBag([...checkoutBag, book]);
  };

  const removeFromBag = (id) => {
    setCheckoutBag(checkoutBag.filter(b => b.id !== id));
  };

  const submitCheckout = async () => {
    try {
      const userId = 2; // patron user id (placeholder)
      const responses = await Promise.all(
        checkoutBag.map(item =>
          fetch('/api/patron/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, bookId: item.id })
          })
        )
      );

      const errors = [];
      for (const r of responses) {
        if (!r.ok) {
          const msg = await r.text();
          errors.push(msg || 'Checkout failed for one item.');
        }
      }

      // Always refetch books to reflect server-side stock after attempts
      const resBooks = await fetch('/api/books');
      if (resBooks.ok) {
        const data = await resBooks.json();
        setBooks(data);
        setFilteredBooks(data);
      }

      // Refetch patron active checkouts
      if (accountType === 'patron' && isAuthed) {
        const res = await fetch(`/api/patron/checkouts/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setPatronActiveCheckouts(data.filter(c => !c.returnDate));
        }
      }

      if (errors.length) {
        alert(errors[0]);
      } else {
        alert('Checkout successful!');
      }

      setCheckoutBag([]);
      setShowBagModal(false);
    } catch (e) {
      console.error(e);
      alert('An error occurred during checkout.');
    }
  };

  const handleReturnBook = async (bookId) => {
    if (accountType !== 'patron') return;
    try {
      const userId = 2; // patron user id (placeholder)
      const res = await fetch('/api/patron/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bookId })
      });
      if (!res.ok) {
        const msg = await res.text();
        console.error('Return failed:', msg);
        return;
      }
      // Refresh books and patron active checkouts
      const [resBooks, resCheckouts] = await Promise.all([
        fetch('/api/books'),
        fetch(`/api/patron/checkouts/${userId}`)
      ]);
      if (resBooks.ok) {
        const data = await resBooks.json();
        setBooks(data);
        setFilteredBooks(data);
      }
      if (resCheckouts.ok) {
        const data = await resCheckouts.json();
        setPatronActiveCheckouts(data.filter(c => !c.returnDate));
      }
    } catch (e) {
      console.error('An error occurred while returning the book.', e);
    }
  };

  const requestReturnBook = (bookId) => {
    setReturnBookId(bookId);
    setShowReturnConfirm(true);
  };

  const cancelReturnRequest = () => {
    setShowReturnConfirm(false);
    setReturnBookId(null);
  };

  const confirmReturnRequest = async () => {
    if (returnBookId == null) return;
    await handleReturnBook(returnBookId);
    setShowReturnConfirm(false);
    setReturnBookId(null);
  };

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

            {accountType === 'admin' && renderStats()}

            {accountType === 'patron' && (
              <div className="patron-checkouts-section mb-5">
                <Card className="stat-card">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="mb-0">Your Active Checkouts</h5>
                      <Badge bg={patronActiveCheckouts.length >= 3 ? 'danger' : 'secondary'}>
                        {patronActiveCheckouts.length} / 3
                      </Badge>
                    </div>
                    {patronActiveCheckouts.length === 0 ? (
                      <p className="text-muted mb-0">You have no active checkouts.</p>
                    ) : (
                      <div className="list-group">
                        {patronActiveCheckouts.map(co => {
                          const book = books.find(b => b.id === co.bookId);
                          return (
                            <div key={co.id} className="list-group-item d-flex justify-content-between align-items-center">
                              <div>
                                <div className="fw-semibold">{book ? book.title : `Book #${co.bookId}`}</div>
                                {book && <small className="text-muted">{book.author}</small>}
                              </div>
                              <div className="d-flex align-items-center">
                                <small className="text-muted me-3">Checked out on {new Date(co.checkoutDate).toLocaleDateString()}</small>
                                <Button
                                  variant="outline-danger"
                                  onClick={() => requestReturnBook(co.bookId)}
                                  size="sm"
                                >
                                  <i className="bi bi-arrow-counterclockwise me-1"></i>
                                  Return
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            )}

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

      {/* Checkout Bag Floating Button */}
      {accountType === 'patron' && (
        <Button
          variant={darkMode ? 'light' : 'dark'}
          className="checkout-bag-fab"
          onClick={openBag}
        >
          <i className="bi bi-bag"></i>
          {checkoutBag.length > 0 && (
            <span className="checkout-bag-count">{checkoutBag.length}</span>
          )}
        </Button>
      )}

      {/* Checkout Bag Modal */}
      <Modal show={showBagModal} onHide={closeBag}>
        <Modal.Header closeButton>
          <Modal.Title>Your Checkout Bag</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {checkoutBag.length === 0 ? (
            <p className="mb-0 text-muted">Your bag is empty. Add up to 3 books.</p>
          ) : (
            <div className="list-group">
              {checkoutBag.map(b => (
                <div key={b.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{b.title}</div>
                    <small className="text-muted">{b.author}</small>
                  </div>
                  <Button variant="outline-danger" size="sm" onClick={() => removeFromBag(b.id)}>
                    <i className="bi bi-x-lg"></i>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="me-auto text-muted small">Max 3 books. 1 copy per title.</div>
          <Button variant="secondary" onClick={closeBag}>Close</Button>
          <Button variant="primary" onClick={submitCheckout} disabled={checkoutBag.length === 0}>
            Checkout
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Return Confirmation Modal */}
      <Modal show={showReturnConfirm} onHide={cancelReturnRequest} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Return</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div>
            <p className="mb-2">
              Are you sure you want to return
              {returnBookId ? ` \"${getBookTitleById(returnBookId)}\"` : ' this book'}?
            </p>
            {returnBookId && (
              <div>
                <small className="text-muted d-block">by {getBookAuthorById(returnBookId)}</small>
                {getCheckoutDateByBookId(returnBookId) && (
                  <small className="text-muted">Checked out on {getCheckoutDateByBookId(returnBookId)}</small>
                )}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelReturnRequest}>Cancel</Button>
          <Button variant="danger" onClick={confirmReturnRequest}>
            <i className="bi bi-arrow-counterclockwise me-2"></i>
            Confirm Return
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default App;