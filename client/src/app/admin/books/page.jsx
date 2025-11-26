import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmDelete from '../../../components/admin/ConfirmDelete';
import toast from 'react-hot-toast';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Dropdown,
  Form,
  InputGroup,
  Modal,
  Row,
  Col,
  Spinner,
  Table,
} from 'react-bootstrap';

import {
  mapBookFromApi,
  getAvailabilityStatus,
  formatUpdatedAt,
} from '../../../lib/books';
import {
  clampPage,
  parseAdminUrlState,
  serializeAdminUrlState,
  VALID_PAGE_SIZES,
} from '../../../lib/urlState';

function AdminBooksPage({ onAddBook, onEditBook, onBackToDashboard }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseAdminUrlState(searchParams), [searchParams]);

  const updateUrlState = useCallback(
    (updates) => {
      const nextState = { ...urlState, ...updates };
      const params = serializeAdminUrlState(nextState);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams, urlState]
  );

  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiesDialog, setCopiesDialog] = useState({ show: false, id: null, title: '', copies: 0 });
  const [copiesSubmitting, setCopiesSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');


  const fetchBooks = useCallback(async () => {
    let active = true;
    const controller = new AbortController();
    try {
      setIsLoading(true);
      setLoadError('');
      const response = await fetch('/api/books', { signal: controller.signal });
      if (!response.ok) {
        throw new Error('Failed to load books');
      }
      const data = await response.json();
      if (!active) return;
      const mapped = Array.isArray(data) ? data.map(mapBookFromApi).filter(Boolean) : [];
      setBooks(mapped);
    } catch (error) {
      if (!active) return;
      if (error.name !== 'AbortError') {
        console.error('[AdminBooks] load error', error);
        setLoadError('Unable to load books. Please try again.');
      }
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Filter and sort books
  const filteredBooks = useMemo(() => {
    let filtered = books;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(searchLower) ||
          book.authors.toLowerCase().includes(searchLower) ||
          book.isbn.toLowerCase().includes(searchLower)
      );
    }

    // Availability filter
    if (urlState.availability !== 'all') {
      filtered = filtered.filter((book) => {
        const status = getAvailabilityStatus(book.copies);
        return status === urlState.availability;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (urlState.sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return a.authors.localeCompare(b.authors);
        case 'copies':
          return b.copies - a.copies;
        case 'updated_desc':
        default:
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
    });

    return filtered;
  }, [books, searchTerm, urlState.availability, urlState.sort]);

  // Pagination
  const totalItems = filteredBooks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / urlState.pageSize));
  const clampedPage = clampPage(urlState.page, totalItems, urlState.pageSize);
  const startIndex = (clampedPage - 1) * urlState.pageSize;
  const endIndex = startIndex + urlState.pageSize;
  const paginatedBooks = filteredBooks.slice(startIndex, endIndex);

  // Update page if it's out of bounds
  useEffect(() => {
    if (clampedPage !== urlState.page) {
      updateUrlState({ page: clampedPage });
    }
  }, [clampedPage, urlState.page, updateUrlState]);

  const handleDelete = async (bookId) => {
    if (!bookId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete book');
      }

      setBooks(prev => prev.filter(book => book.id !== bookId));
      toast.success('Book deleted successfully');
      setDeleteId(null);
    } catch (error) {
      console.error('[AdminBooks] delete error', error);
      toast.error('Failed to delete book');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateCopies = async () => {
    if (!copiesDialog.id) return;

    setCopiesSubmitting(true);
    try {
      const payload = { copies: Math.max(0, copiesDialog.copies) };
      const response = await fetch(`/api/books/${copiesDialog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update copies');
      }

      setBooks(prev => prev.map(book =>
        book.id === copiesDialog.id
          ? { ...book, copies: payload.copies }
          : book
      ));

      toast.success('Copies updated successfully');
      setCopiesDialog({ show: false, id: null, title: '', copies: 0 });
    } catch (error) {
      console.error('[AdminBooks] update copies error', error);
      toast.error('Failed to update copies');
    } finally {
      setCopiesSubmitting(false);
    }
  };

  const renderTableView = () => (
    <div className="table-responsive">
      <Table hover className="mb-0">
        <thead className="table-light">
          <tr>
            <th>Title</th>
            <th>Authors</th>
            <th>ISBN</th>
            <th>Pages</th>
            <th>Copies</th>
            <th>Status</th>
            <th>Updated</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedBooks.map((book) => (
            <tr key={book.id}>
              <td className="fw-semibold">{book.title}</td>
              <td>{book.authors}</td>
              <td className="font-monospace small">{book.isbn}</td>
              <td>{book.pageCount || '—'}</td>
              <td>{book.copies}</td>
              <td>
                <Badge bg={getAvailabilityStatus(book.copies) === 'available' ? 'success' :
                          getAvailabilityStatus(book.copies) === 'low' ? 'warning' : 'danger'}>
                  {getAvailabilityStatus(book.copies) === 'available' ? 'Available' :
                   getAvailabilityStatus(book.copies) === 'low' ? 'Low Stock' : 'Out of Stock'}
                </Badge>
              </td>
              <td className="small text-muted">{formatUpdatedAt(book.updatedAt)}</td>
              <td className="text-end">
                <Dropdown align="end">
                  <Dropdown.Toggle variant="link" className="text-decoration-none p-0">
                    <i className="bi bi-three-dots-vertical"></i>
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => onEditBook(book)}>
                      <i className="bi bi-pencil me-2"></i>
                      Edit
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setCopiesDialog({
                      show: true,
                      id: book.id,
                      title: book.title,
                      copies: book.copies
                    })}>
                      <i className="bi bi-hash me-2"></i>
                      Update Copies
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      className="text-danger"
                      onClick={() => setDeleteId(book.id)}
                    >
                      <i className="bi bi-trash me-2"></i>
                      Delete
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );

  const renderCardView = () => (
    <div className="row g-3">
      {paginatedBooks.map((book) => (
        <div key={book.id} className="col-md-6 col-lg-4">
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="flex-grow-1 me-2">
                  <Card.Title className="h6 mb-1">
                    {book.title}
                  </Card.Title>
                  <Card.Subtitle className="small text-muted mb-2">
                    by {book.authors}
                  </Card.Subtitle>
                </div>
                <Dropdown align="end">
                  <Dropdown.Toggle variant="link" className="text-decoration-none p-0">
                    <i className="bi bi-three-dots-vertical"></i>
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => onEditBook(book)}>
                      <i className="bi bi-pencil me-2"></i>
                      Edit
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => setCopiesDialog({
                      show: true,
                      id: book.id,
                      title: book.title,
                      copies: book.copies
                    })}>
                      <i className="bi bi-hash me-2"></i>
                      Update Copies
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      className="text-danger"
                      onClick={() => setDeleteId(book.id)}
                    >
                      <i className="bi bi-trash me-2"></i>
                      Delete
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <small className="text-muted">
                  <i className="bi bi-upc-scan me-1"></i>
                  {book.isbn}
                </small>
                <small className="text-muted">
                  <i className="bi bi-file-text me-1"></i>
                  {book.pageCount || '—'} pages
                </small>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <Badge bg={getAvailabilityStatus(book.copies) === 'available' ? 'success' :
                            getAvailabilityStatus(book.copies) === 'low' ? 'warning' : 'danger'}>
                    {getAvailabilityStatus(book.copies) === 'available' ? 'Available' :
                     getAvailabilityStatus(book.copies) === 'low' ? 'Low Stock' : 'Out of Stock'}
                  </Badge>
                  <small className="ms-2 text-muted">
                    {book.copies} {book.copies === 1 ? 'copy' : 'copies'}
                  </small>
                </div>
                <small className="text-muted">
                  Updated {formatUpdatedAt(book.updatedAt)}
                </small>
              </div>
            </Card.Body>
          </Card>
        </div>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" size="lg" />
          <p className="mt-3">Loading books...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Book Management</h1>
          <p className="text-muted mb-0">Manage your library collection</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchBooks} disabled={isLoading}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
          <Button variant="primary" onClick={onAddBook}>
            <i className="bi bi-plus-circle me-2"></i>
            Add Book
          </Button>
        </div>
      </div>

      {loadError && (
        <Alert variant="danger" className="mb-4">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {loadError}
        </Alert>
      )}

      {/* Toolbar */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Search</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Title, author, or ISBN..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      updateUrlState({ page: 1 });
                    }}
                  />
                </InputGroup>
              </Form.Group>
            </Col>

            <Col md={2}>
              <Form.Group>
                <Form.Label>Availability</Form.Label>
                <Form.Select
                  value={urlState.availability}
                  onChange={(e) => updateUrlState({ availability: e.target.value, page: 1 })}
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={2}>
              <Form.Group>
                <Form.Label>Sort By</Form.Label>
                <Form.Select
                  value={urlState.sort}
                  onChange={(e) => updateUrlState({ sort: e.target.value, page: 1 })}
                >
                  <option value="updated_desc">Recently Updated</option>
                  <option value="title">Title A-Z</option>
                  <option value="author">Author A-Z</option>
                  <option value="copies">Copies (High-Low)</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={2}>
              <Form.Group>
                <Form.Label>View</Form.Label>
                <div className="d-flex gap-1">
                  <Button
                    variant={urlState.view === 'table' ? 'primary' : 'outline-primary'}
                    size="sm"
                    onClick={() => updateUrlState({ view: 'table' })}
                  >
                    <i className="bi bi-table"></i>
                  </Button>
                  <Button
                    variant={urlState.view === 'cards' ? 'primary' : 'outline-primary'}
                    size="sm"
                    onClick={() => updateUrlState({ view: 'cards' })}
                  >
                    <i className="bi bi-grid-3x3-gap"></i>
                  </Button>
                </div>
              </Form.Group>
            </Col>

            <Col md={2}>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={onBackToDashboard}>
                  <i className="bi bi-arrow-left me-2"></i>
                  Back to Dashboard
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Results Summary */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Books ({totalItems})</h5>
          {searchTerm && (
            <small className="text-muted">Results for "{searchTerm}"</small>
          )}
        </div>
        <div className="text-muted small">
          Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
        </div>
      </div>

      {/* Books List */}
      {totalItems === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <i className="bi bi-search display-1 text-muted mb-3"></i>
            <h5>No books found</h5>
            <p className="text-muted mb-3">
              {searchTerm ? `No books match "${searchTerm}"` : 'Your library is empty'}
            </p>
            <Button variant="primary" onClick={onAddBook}>
              <i className="bi bi-plus-circle me-2"></i>
              Add Your First Book
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card>
            <Card.Body className="p-0">
              {urlState.view === 'table' ? renderTableView() : renderCardView()}
            </Card.Body>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">Show</span>
                <Form.Select
                  size="sm"
                  style={{ width: '80px' }}
                  value={urlState.pageSize}
                  onChange={(e) => updateUrlState({ pageSize: parseInt(e.target.value), page: 1 })}
                >
                  {VALID_PAGE_SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </Form.Select>
                <span className="small text-muted">per page</span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={clampedPage <= 1}
                  onClick={() => updateUrlState({ page: clampedPage - 1 })}
                >
                  <i className="bi bi-chevron-left"></i>
                </Button>

                <span className="small text-muted">
                  {clampedPage} of {totalPages}
                </span>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={clampedPage >= totalPages}
                  onClick={() => updateUrlState({ page: clampedPage + 1 })}
                >
                  <i className="bi bi-chevron-right"></i>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        show={!!deleteId}
        bookTitle={deleteId ? books.find(b => b.id === deleteId)?.title : ''}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        isLoading={isDeleting}
      />

      {/* Update Copies Modal */}
      <Modal show={copiesDialog.show} onHide={() => setCopiesDialog({ show: false, id: null, title: '', copies: 0 })}>
        <Modal.Header closeButton>
          <Modal.Title>Update Copies</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            Update the number of available copies for <strong>{copiesDialog.title}</strong>
          </p>
          <Form.Group>
            <Form.Label>Available Copies</Form.Label>
            <Form.Control
              type="number"
              min="0"
              value={copiesDialog.copies}
              onChange={(e) => setCopiesDialog(prev => ({
                ...prev,
                copies: Math.max(0, parseInt(e.target.value) || 0)
              }))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setCopiesDialog({ show: false, id: null, title: '', copies: 0 })}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateCopies}
            disabled={copiesSubmitting}
          >
            {copiesSubmitting ? 'Updating...' : 'Update Copies'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default AdminBooksPage;
