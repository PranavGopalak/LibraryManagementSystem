// src/App.js
import React, { useState, useEffect } from 'react';

import './App.css';
import { Navbar, Container, Row, Col, Card, Button, Nav, Dropdown, Form, InputGroup, Badge, Modal, Table, ProgressBar, Alert } from 'react-bootstrap';
import { signup as apiSignup, login as apiLogin, storeToken, clearToken as clearAuthToken, getToken } from './api/auth';
import AdminDashboard from './app/admin/page';
import AdminBooksPage from './app/admin/books/page';



function App() {
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('auth') === 'true');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupRole, setSignupRole] = useState('patron');
  const [adminCode, setAdminCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard' or 'books'
  const [patronView, setPatronView] = useState('dashboard'); // 'dashboard' or 'books'
  const [adminBooksRefreshKey, setAdminBooksRefreshKey] = useState(0);
  const [checkoutHistory, setCheckoutHistory] = useState([]);
  const [checkoutRefreshKey, setCheckoutRefreshKey] = useState(0);
  const [showCheckoutHistoryModal, setShowCheckoutHistoryModal] = useState(false);
  // Expose functions for admin dashboard
  const handleOpenAddModal = () => setShowAddModal(true);
  const handleOpenEditModal = (book) => {
    setEditingBook(book);
    setShowEditModal(true);
  };

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

  // Filter books based on search term
  useEffect(() => {
    let filtered = books;

    if (searchTerm) {
      filtered = filtered.filter(book =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBooks(filtered);
  }, [searchTerm, books]);

  useEffect(() => {
    const fetchPatronCheckouts = async () => {
      if (accountType === 'patron' && isAuthed) {
        try {
          const storedUserId = Number(localStorage.getItem('user_id'));
          if (!storedUserId) return;
          console.log('Fetching patron checkouts for user:', storedUserId);
          const res = await fetch(`/api/patron/checkouts/${storedUserId}`);
          if (res.ok) {
            const data = await res.json();
            console.log('Raw checkout data:', data);

            // Filter active checkouts (not returned)
            const activeCheckouts = data.filter(c => !c.returnDate);
            setPatronActiveCheckouts(activeCheckouts);
            console.log('Active checkouts:', activeCheckouts);

            // Set checkout history with returned items, mapped to expected format
            const returnedCheckouts = data.filter(c => c.returnDate)
              .sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate)) // Sort by most recent return first
              .map(checkout => {
                // Calculate due date as 1 year from checkout date (dummy date for display)
                const checkoutDate = new Date(checkout.checkoutDate);
                const dueDate = new Date(checkoutDate);
                dueDate.setFullYear(dueDate.getFullYear() + 1);

                return {
                  id: checkout.id,
                  bookTitle: books.find(b => b.id === checkout.bookId)?.title || `Book #${checkout.bookId}`,
                  checkoutDate: checkout.checkoutDate,
                  dueDate: dueDate.toISOString(),
                  returnDate: checkout.returnDate
                };
              });
            console.log('Checkout history:', returnedCheckouts);
            setCheckoutHistory(returnedCheckouts);
          } else {
            console.error('Failed to fetch checkouts, status:', res.status);
          }
        } catch (e) {
          console.error('Failed to fetch patron checkouts', e);
        }
      } else {
        setPatronActiveCheckouts([]);
        setCheckoutHistory([]);
      }
    };
    fetchPatronCheckouts();
  }, [accountType, isAuthed, books, checkoutRefreshKey]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      console.log('[UI][LOGIN] submitting', { usernameOrEmail: username });
      const res = await apiLogin({ usernameOrEmail: username, password });
      storeToken(res.token);
      localStorage.setItem('auth', 'true');
      if (res.user && typeof res.user.id !== 'undefined') {
        localStorage.setItem('user_id', String(res.user.id));
      }
      if (res.user && res.user.username) {
        localStorage.setItem('username', res.user.username);
      }
      localStorage.setItem('accountType', res.user?.role || 'patron');
      setIsAuthed(true);
      setAccountType(res.user?.role || 'patron');
      setLoginError('');
      console.log('[UI][LOGIN] success', res.user);
    } catch (err) {
      console.warn('[UI][LOGIN] error', err);
      setLoginError(err?.message || 'Login failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      // Simple client-side validation to avoid round trips
      const usernameValid = typeof username === 'string' && /^[A-Za-z0-9_]{3,30}$/.test(username);
      const emailValid = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const passwordValid = typeof password === 'string' && password.length >= 8;
      if (!usernameValid || !emailValid || !passwordValid) {
        const msg = !usernameValid
          ? 'Username must be 3-30 chars: letters, numbers, underscore.'
          : !emailValid
            ? 'Please enter a valid email address.'
            : 'Password must be at least 8 characters.';
        setLoginError(msg);
        console.warn('[UI][SIGNUP] client validation failed', { usernameValid, emailValid, passwordValid });
        return;
      }
      console.log('[UI][SIGNUP] submitting', { username, emailPresent: !!email, signupRole });
      const res = await apiSignup({ username, email, password, role: signupRole, adminInviteCode: adminCode || undefined });
      storeToken(res.token);
      localStorage.setItem('auth', 'true');
      if (res.user && typeof res.user.id !== 'undefined') {
        localStorage.setItem('user_id', String(res.user.id));
      }
      if (res.user && res.user.username) {
        localStorage.setItem('username', res.user.username);
      }
      localStorage.setItem('accountType', res.user?.role || 'patron');
      setIsAuthed(true);
      setAccountType(res.user?.role || 'patron');
      setLoginError('');
      console.log('[UI][SIGNUP] success', res.user);
    } catch (err) {
      console.warn('[UI][SIGNUP] error', err);
      const serverMsg = err?.data?.details
        ? (!err.data.details.usernameValid
          ? 'Username must be 3-30 chars: letters, numbers, underscore.'
          : !err.data.details.emailValid
            ? 'Please enter a valid email address.'
            : !err.data.details.passwordValid
              ? 'Password must be at least 8 characters.'
              : err?.message)
        : err?.message;
      setLoginError(serverMsg || 'Signup failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('accountType');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    clearAuthToken();
    setIsAuthed(false);
    setUsername('');
    setEmail('');
    setPassword('');
    setSearchTerm('');
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
      setAdminBooksRefreshKey((prev) => prev + 1);
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

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };


  const renderBookCard = (book) => (
    <Col key={book.id} xs={12} sm={6} lg={4} xl={3}>
      <Card className="h-100 book-card">
        {accountType === 'admin' && (
          <div className="book-actions">
            <Dropdown align="end" className="settings-dropdown">
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

    // Optimistic update - immediately add to bag
    setCheckoutBag(prev => [...prev, book]);
    console.log(`Book "${book.title}" added to checkout bag`);
  };

  const removeFromBag = (id) => {
    const bookToRemove = checkoutBag.find(b => b.id === id);
    setCheckoutBag(prev => prev.filter(b => b.id !== id));
    if (bookToRemove) {
      console.log(`Book "${bookToRemove.title}" removed from checkout bag`);
    }
  };

  const submitCheckout = async () => {
    try {
      const token = getToken();
      if (!token) {
        console.error('Session expired');
        return;
      }

      // Optimistic UI updates - update immediately for better UX
      const successfulItems = [...checkoutBag]; // Assume all will succeed initially
      const now = Date.now();
      const oneYear = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

      // Immediately update book availability
      setBooks(prevBooks =>
        prevBooks.map(book =>
          checkoutBag.some(item => item.id === book.id)
            ? { ...book, copies: Math.max(0, book.copies - 1) }
            : book
        )
      );

      // Immediately add to active checkouts
      const newActiveCheckouts = successfulItems.map((item, index) => ({
        id: `temp-${now + index}`,
        bookId: item.id,
        checkoutDate: new Date(now + index * 1000).toISOString(),
        dueDate: new Date(now + oneYear + index * 1000).toISOString(),
        returnDate: null,
        title: item.title,
        author: item.author
      }));
      setPatronActiveCheckouts(prev => [...prev, ...newActiveCheckouts]);

      // Close modal immediately
      setCheckoutBag([]);
      setShowBagModal(false);

      // Now make the actual API calls
      const responses = await Promise.all(
        checkoutBag.map((item) =>
          fetch('/api/patron/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ bookId: item.id }),
          })
        )
      );

      console.log('Checkout responses:', responses);
      const errors = [];
      const actuallySuccessful = [];

      for (let i = 0; i < responses.length; i += 1) {
        const r = responses[i];
        if (!r.ok) {
          const msg = await r.text();
          errors.push(msg || 'Checkout failed for one item.');
          // Revert optimistic updates for failed items
          setBooks(prevBooks =>
            prevBooks.map(book =>
              checkoutBag[i].id === book.id
                ? { ...book, copies: book.copies + 1 }
                : book
            )
          );
          setPatronActiveCheckouts(prev =>
            prev.filter(co => co.bookId !== checkoutBag[i].id || !co.id.toString().startsWith('temp-'))
          );
        } else {
          actuallySuccessful.push(checkoutBag[i]);
        }
      }

      // Refetch latest data from server to ensure consistency
      const [resBooks, resCheckouts] = await Promise.all([
        fetch('/api/books'),
        accountType === 'patron' && isAuthed ?
          fetch(`/api/patron/checkouts/${localStorage.getItem('user_id')}`) :
          Promise.resolve(null)
      ]);

      if (resBooks.ok) {
        const data = await resBooks.json();
        setBooks(data);
        setFilteredBooks(data);
      }

      if (resCheckouts && resCheckouts.ok) {
        const data = await resCheckouts.json();
        setPatronActiveCheckouts(data.filter(c => !c.returnDate));
        setCheckoutRefreshKey(prev => prev + 1);
      }

      if (errors.length) {
        console.error('Some checkouts failed:', errors);
      } else {
        console.log('All checkouts successful!');
      }

    } catch (e) {
      console.error('Checkout error:', e);

      // Revert all optimistic updates on error
      setBooks(prevBooks =>
        prevBooks.map(book =>
          checkoutBag.some(item => item.id === book.id)
            ? { ...book, copies: book.copies + 1 }
            : book
        )
      );
      setPatronActiveCheckouts(prev =>
        prev.filter(co => !co.id.toString().startsWith('temp-'))
      );
      setCheckoutBag([]);
      setShowBagModal(false);
    }
  };

  const handleReturnBook = async (bookId) => {
    if (accountType !== 'patron') return;

    // Optimistic UI updates - update immediately
    const checkoutToReturn = patronActiveCheckouts.find(co => co.bookId === bookId);
    if (checkoutToReturn) {
      // Immediately increase book availability
      setBooks(prevBooks =>
        prevBooks.map(book =>
          book.id === bookId
            ? { ...book, copies: book.copies + 1 }
            : book
        )
      );

      // Immediately remove from active checkouts
      setPatronActiveCheckouts(prev =>
        prev.filter(co => co.bookId !== bookId)
      );

      // Immediately add to checkout history
      const returnedEntry = {
        id: checkoutToReturn.id,
        bookTitle: checkoutToReturn.title,
        checkoutDate: checkoutToReturn.checkoutDate,
        dueDate: checkoutToReturn.dueDate,
        returnDate: new Date().toISOString()
      };
      setCheckoutHistory(prev => [returnedEntry, ...prev.filter(entry => entry.id !== checkoutToReturn.id)]);
    }

    try {
      const token = getToken();
      if (!token) {
        console.error('Session expired');
        return;
      }
      const res = await fetch('/api/patron/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId })
      });
      if (!res.ok) {
        const msg = await res.text();
        console.error('Return failed:', msg);
        // Revert optimistic updates on failure
        if (checkoutToReturn) {
          setBooks(prevBooks =>
            prevBooks.map(book =>
              book.id === bookId
                ? { ...book, copies: book.copies - 1 }
                : book
            )
          );
          setPatronActiveCheckouts(prev => [...prev, checkoutToReturn]);
          setCheckoutHistory(prev => prev.filter(entry => entry.id !== checkoutToReturn.id));
        }
        return;
      }
      console.log('Book return successful for bookId:', bookId);

      // Refetch latest data from server to ensure consistency
      const [resBooks, resCheckouts] = await Promise.all([
        fetch('/api/books'),
        (async () => {
          const storedUserId = Number(localStorage.getItem('user_id'));
          if (!storedUserId) return { ok: false };
          return fetch(`/api/patron/checkouts/${storedUserId}`);
        })()
      ]);

      if (resBooks.ok) {
        const data = await resBooks.json();
        setBooks(data);
        setFilteredBooks(data);
      }
      if (resCheckouts && resCheckouts.ok) {
        const data = await resCheckouts.json();
        setPatronActiveCheckouts(data.filter(c => !c.returnDate));
        setCheckoutRefreshKey(prev => prev + 1);
      }
    } catch (e) {
      console.error('An error occurred while returning the book.', e);
      // Revert optimistic updates on error
      if (checkoutToReturn) {
        setBooks(prevBooks =>
          prevBooks.map(book =>
            book.id === bookId
              ? { ...book, copies: book.copies - 1 }
              : book
          )
        );
        setPatronActiveCheckouts(prev => [...prev, checkoutToReturn]);
        setCheckoutHistory(prev => prev.filter(entry => entry.id !== checkoutToReturn.id));
      }
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
            <Dropdown align="end" className="settings-dropdown" popperConfig={{ strategy: 'fixed' }}>
              <Dropdown.Toggle variant={darkMode ? 'outline-light' : 'outline-dark'} id="settings-dropdown">
                <i className="bi bi-gear me-2"></i>Settings
              </Dropdown.Toggle>
              <Dropdown.Menu className="settings-dropdown-menu" style={{ zIndex: 99999 }}>
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
                  {isSignup ? (
                    <>
                      <Form.Group className="mb-3" controlId="signup_username">
                        <Form.Label>Username</Form.Label>
                        <Form.Control
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Choose a username"
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3" controlId="signup_email">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3" controlId="signup_password">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a password"
                          required
                        />
                      </Form.Group>
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3" controlId="signup_role">
                            <Form.Label>Account Type</Form.Label>
                            <Form.Select value={signupRole} onChange={(e) => setSignupRole(e.target.value)}>
                              <option value="patron">Patron</option>
                              <option value="admin">Admin</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          {signupRole === 'admin' && (
                            <Form.Group className="mb-3" controlId="signup_admin_code">
                              <Form.Label>Admin Invite Code</Form.Label>
                              <Form.Control
                                type="text"
                                value={adminCode}
                                onChange={(e) => setAdminCode(e.target.value)}
                                placeholder="Enter admin code"
                                required={signupRole === 'admin'}
                              />
                            </Form.Group>
                          )}
                        </Col>
                      </Row>
                    </>
                  ) : (
                    <>
                      <Form.Group className="mb-3" controlId="login_usernameOrEmail">
                        <Form.Label>Email or Username</Form.Label>
                        <Form.Control
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Email or username"
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3" controlId="login_password">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your password"
                          required
                        />
                      </Form.Group>
                    </>
                  )}
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
          accountType === 'admin' ? (
            adminView === 'dashboard' ? (
              <AdminDashboard
                onAddBook={handleOpenAddModal}
                onEditBook={handleOpenEditModal}
                onViewBooks={() => setAdminView('books')}
                checkoutHistory={checkoutHistory}
                onViewCheckoutHistory={() => setShowCheckoutHistoryModal(true)}
              />
            ) : (
              <AdminBooksPage
                onAddBook={handleOpenAddModal}
                onEditBook={handleOpenEditModal}
                onBackToDashboard={() => setAdminView('dashboard')}
                refreshKey={adminBooksRefreshKey}
              />
            )
          ) : (
            <>
              <div className="page-header mb-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h1 className="page-title">
                      {patronView === 'dashboard' ? 'My Library Dashboard' : 'Library Collection'}
                    </h1>
                    <p className="page-subtitle text-muted">
                      {patronView === 'dashboard'
                        ? `Welcome back, ${username || 'Reader'}! Manage your books and discover new reads from our collection.`
                        : 'Discover and explore our vast collection of books'
                      }
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

              {patronView === 'dashboard' ? (
                <>
                  {/* Dashboard Quick Actions */}
                  <Row className="mb-4">
                    <Col md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center p-4">
                          <div className="mb-3">
                            <i className="bi bi-journal-text display-5 text-primary"></i>
                          </div>
                          <h5 className="card-title">Browse Books</h5>
                          <p className="text-muted">Explore our collection and find your next read</p>
                          <Button
                            variant="primary"
                            onClick={() => setPatronView('books')}
                            className="mt-3"
                            size="lg"
                          >
                            <i className="bi bi-search me-2"></i>
                            Browse Collection
                          </Button>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center p-4">
                          <div className="mb-3">
                            <i className="bi bi-info-circle display-5 text-info"></i>
                          </div>
                          <h5 className="card-title">Library Info</h5>
                          <p className="text-muted">Learn about library policies and hours</p>
                          <Button
                            variant="outline-info"
                            className="mt-3"
                            size="lg"
                            disabled
                          >
                            <i className="bi bi-info-circle me-2"></i>
                            Coming Soon
                          </Button>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Dashboard Stats */}
                  <Row className="mb-4">
                    <Col lg={3} md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center">
                          <div className="mb-3">
                            <i className="bi bi-book-half display-4 text-primary"></i>
                          </div>
                          <h3 className="h2 mb-1">{patronActiveCheckouts.length}</h3>
                          <p className="text-muted mb-2">Books Checked Out</p>
                          <ProgressBar
                            now={(patronActiveCheckouts.length / 3) * 100}
                            variant={patronActiveCheckouts.length >= 3 ? 'danger' : 'primary'}
                            className="mt-2"
                            style={{ height: '6px' }}
                          />
                          <small className="text-muted mt-1 d-block">
                            {3 - patronActiveCheckouts.length} more available
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col lg={3} md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center">
                          <div className="mb-3">
                            <i className="bi bi-collection display-4 text-info"></i>
                          </div>
                          <h3 className="h2 mb-1">{books.length}</h3>
                          <p className="text-muted mb-2">Books in Library</p>
                          <small className="text-muted">
                            {books.filter(book => book.copies > 0).length} available now
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col lg={3} md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center">
                          <div className="mb-3">
                            <i className="bi bi-clock-history display-4 text-success"></i>
                          </div>
                          <h3 className="h2 mb-1">{checkoutHistory.length}</h3>
                          <p className="text-muted mb-2">Total Checkouts</p>
                          <small className="text-muted">
                            Books you've borrowed
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col lg={3} md={6} className="mb-3">
                      <Card className="h-100">
                        <Card.Body className="text-center">
                          <div className="mb-3">
                            <i className="bi bi-calendar-event display-4 text-warning"></i>
                          </div>
                          <h3 className="h2 mb-1">
                            {patronActiveCheckouts.filter(co => {
                              const dueDate = new Date(co.dueDate);
                              const now = new Date();
                              const diffTime = dueDate - now;
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return diffDays <= 7 && diffDays >= 0;
                            }).length}
                          </h3>
                          <p className="text-muted mb-2">Due This Week</p>
                          <small className="text-muted">
                            Books due in 7 days
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Due Date Alerts */}
                  {patronActiveCheckouts.some(co => {
                    const dueDate = new Date(co.dueDate);
                    const now = new Date();
                    const diffTime = dueDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= 3 && diffDays >= 0;
                  }) && (
                      <Alert variant="warning" className="mb-4">
                        <Alert.Heading>
                          <i className="bi bi-clock me-2"></i>
                          Books Due Soon
                        </Alert.Heading>
                        <p className="mb-0">
                          You have books due within the next 3 days. Please return them on time to avoid fines.
                        </p>
                      </Alert>
                    )}

                  {/* Overdue Alerts */}
                  {patronActiveCheckouts.some(co => {
                    const dueDate = new Date(co.dueDate);
                    const now = new Date();
                    return dueDate < now;
                  }) && (
                      <Alert variant="danger" className="mb-4">
                        <Alert.Heading>
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Overdue Books
                        </Alert.Heading>
                        <p className="mb-0">
                          You have overdue books that need to be returned immediately.
                        </p>
                      </Alert>
                    )}

                  {/* Current Checkouts */}
                  <Row className="mb-5">
                    <Col lg={8} className="mb-4 mb-lg-0">
                      <Card>
                        <Card.Header>
                          <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">Current Checkouts</h5>
                            <Badge bg={patronActiveCheckouts.length >= 3 ? 'danger' : 'secondary'}>
                              {patronActiveCheckouts.length} / 3 books
                            </Badge>
                          </div>
                        </Card.Header>
                        <Card.Body>
                          {patronActiveCheckouts.length === 0 ? (
                            <div className="text-center py-4">
                              <i className="bi bi-book-half display-4 text-muted mb-3"></i>
                              <h5 className="text-muted">No Active Checkouts</h5>
                              <p className="text-muted mb-3">You haven't checked out any books yet.</p>
                              <p className="text-muted small">Browse the collection below to find your next read!</p>
                            </div>
                          ) : (
                            <div className="checkout-list">
                              {patronActiveCheckouts.map(co => {
                                const book = books.find(b => b.id === co.bookId);
                                // Calculate due date as 1 year from checkout date (dummy date for display)
                                const checkoutDate = new Date(co.checkoutDate);
                                const dueDate = new Date(checkoutDate);
                                dueDate.setFullYear(dueDate.getFullYear() + 1);

                                const now = new Date();
                                const diffTime = dueDate - now;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                const isOverdue = diffDays < 0;
                                const isDueSoon = diffDays <= 3 && diffDays >= 0;

                                return (
                                  <div key={co.id} className="checkout-item mb-3 p-3 border rounded">
                                    <div className="d-flex justify-content-between align-items-start">
                                      <div className="flex-grow-1">
                                        <h6 className="mb-1">{book ? book.title : `Book #${co.bookId}`}</h6>
                                        {book && <small className="text-muted d-block mb-2">by {book.author}</small>}
                                        <div className="d-flex align-items-center gap-3">
                                          <small className="text-muted">
                                            <i className="bi bi-calendar me-1"></i>
                                            Checked out: {new Date(co.checkoutDate).toLocaleDateString()}
                                          </small>
                                          <Badge bg={
                                            isOverdue ? 'danger' :
                                              isDueSoon ? 'warning' :
                                                'secondary'
                                          }>
                                            {isOverdue ? `${Math.abs(diffDays)} days overdue` :
                                              isDueSoon ? `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}` :
                                                `Due: ${dueDate.toLocaleDateString()}`}
                                          </Badge>
                                        </div>
                                      </div>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => requestReturnBook(co.bookId)}
                                      >
                                        <i className="bi bi-arrow-left-circle me-1"></i>
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
                    </Col>

                    <Col lg={4}>
                      {/* Library Statistics */}
                      <Card className="mb-4">
                        <Card.Header>
                          <h5 className="mb-0">Library Statistics</h5>
                        </Card.Header>
                        <Card.Body>
                          <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="small">Total Books</span>
                              <Badge bg="primary">{books.length}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="small">Available Now</span>
                              <Badge bg="success">{books.filter(book => book.copies > 0).length}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="small">Checked Out</span>
                              <Badge bg="warning">{books.reduce((sum, book) => sum + (book.copies - Math.max(0, book.copies - 1)), 0)}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="small">Your Checkouts</span>
                              <Badge bg={patronActiveCheckouts.length >= 3 ? 'danger' : 'info'}>{patronActiveCheckouts.length}/3</Badge>
                            </div>
                          </div>
                          <small className="text-muted">Real-time library data</small>
                        </Card.Body>
                      </Card>

                      {/* Recent Activity */}
                      <Card>
                        <Card.Header>
                          <h5 className="mb-0">Recent Activity</h5>
                        </Card.Header>
                        <Card.Body>
                          {checkoutHistory.length === 0 ? (
                            <p className="text-muted mb-0 small">No recent activity</p>
                          ) : (
                            <div className="activity-list">
                              {checkoutHistory.slice(0, 3).map((entry, index) => (
                                <div key={entry.id} className="d-flex align-items-center mb-2">
                                  <div className="activity-icon me-2 text-success">
                                    <i className="bi bi-arrow-left-circle"></i>
                                  </div>
                                  <div className="flex-grow-1">
                                    <small className="d-block fw-semibold text-truncate" style={{ maxWidth: '120px' }}>
                                      {entry.bookTitle}
                                    </small>
                                    <small className="text-muted">
                                      Returned {new Date(entry.returnDate).toLocaleDateString()}
                                    </small>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </>
              ) : (
                <>
                  {/* Book Browsing View */}
                  <div className="mb-4">
                    <Button
                      variant="outline-secondary"
                      onClick={() => setPatronView('dashboard')}
                      className="mb-4"
                    >
                      <i className="bi bi-arrow-left me-2"></i>
                      Back to Dashboard
                    </Button>
                  </div>

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
                      </div>
                      <Row xs={1} sm={2} lg={3} xl={4} className="g-4">
                        {filteredBooks.map(renderBookCard)}
                      </Row>
                    </>
                  )}
                </>
              )}
            </>
          )
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
              {returnBookId ? ` "${getBookTitleById(returnBookId)}"` : ' this book'}?
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

      {/* Checkout History Modal */}
      <Modal
        show={showCheckoutHistoryModal}
        onHide={() => setShowCheckoutHistoryModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Checkout History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Patron</th>
                  <th>Checked Out</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {checkoutHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No checkout history yet.
                    </td>
                  </tr>
                ) : (
                  checkoutHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.bookTitle}</td>
                      <td>{entry.patronName}</td>
                      <td>{formatDateTime(entry.checkoutDate)}</td>
                      <td>{formatDateTime(entry.dueDate)}</td>
                      <td>
                        <Badge
                          bg={
                            entry.status === 'checked_out'
                              ? 'primary'
                              : entry.status === 'returned'
                                ? 'success'
                                : 'danger'
                          }
                        >
                          {entry.status === 'checked_out'
                            ? 'Checked Out'
                            : entry.status === 'returned'
                              ? 'Returned'
                              : 'Overdue'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCheckoutHistoryModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default App;