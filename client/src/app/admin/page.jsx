import React, { useCallback, useEffect, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  ProgressBar,
  Alert,
  ListGroup,
  Dropdown,
  Spinner
} from 'react-bootstrap';

function AdminDashboard({ onAddBook, onEditBook, onViewBooks }) {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalPatrons: 0,
    activeUsers: 0,
    overdueBooks: 0,
    returnedToday: 0
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch books data
      const booksResponse = await fetch('/api/books');
      if (!booksResponse.ok) throw new Error('Failed to fetch books');
      const booksData = await booksResponse.json();
      setBooks(booksData);

      // Simulate additional data (in real app, these would be separate API calls)
      // For now, we'll generate some mock data based on the books
      setRecentActivity(generateMockActivity(booksData));
      setSystemStats(generateMockStats(booksData));

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const generateMockActivity = (booksData) => {
    // Mock recent activity - in real app this would come from audit logs
    const activities = [];
    const now = new Date();
    const activityTypes = ['checkout', 'return', 'added', 'updated'];
    const userNames = ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Emma Brown', 'Frank Miller', 'Grace Lee', 'Henry Taylor'];

    // Generate activities for the last 48 hours
    booksData.slice(0, Math.min(8, booksData.length)).forEach((book, index) => {
      const hoursAgo = Math.floor(Math.random() * 48);
      const activityTime = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));

      activities.push({
        id: index + 1,
        type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
        book: book.title.length > 30 ? book.title.substring(0, 30) + '...' : book.title,
        user: userNames[Math.floor(Math.random() * userNames.length)],
        timestamp: activityTime,
        copies: book.copies
      });
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  };

  const generateMockStats = (booksData) => {
    const totalBooks = booksData.length;
    // Estimate patron count based on book collection size
    const estimatedPatrons = Math.max(50, Math.floor(totalBooks * 1.5));
    const activeUsers = Math.floor(estimatedPatrons * 0.3); // 30% active
    const overdueBooks = Math.floor(activeUsers * 0.1); // 10% of active users have overdue books
    const returnedToday = Math.floor(activeUsers * 0.05); // 5% return books daily

    return {
      totalPatrons: estimatedPatrons,
      activeUsers,
      overdueBooks,
      returnedToday
    };
  };

  // Calculate key metrics
  const totalBooks = books.length;
  const availableBooks = books.filter(book => book.copies > 0).length;
  const outOfStockBooks = books.filter(book => book.copies === 0).length;
  const lowStockBooks = books.filter(book => book.copies > 0 && book.copies <= 2).length;
  const totalCopies = books.reduce((sum, book) => sum + book.copies, 0);

  // Estimate checked out copies (total copies - current available)
  // In a real app, this would come from checkout records
  const estimatedCheckedOut = Math.max(0, totalCopies - books.reduce((sum, book) => sum + Math.min(book.copies, 5), 0));

  const utilizationRate = totalCopies > 0 ? Math.round((estimatedCheckedOut / totalCopies) * 100) : 0;

  // Genre distribution (using description keywords or default categorization)
  const genreStats = books.reduce((acc, book) => {
    // Try to infer genre from description or title keywords
    let genre = 'General Fiction';
    const text = (book.description + ' ' + book.title).toLowerCase();

    if (text.includes('science') || text.includes('technology') || text.includes('programming')) {
      genre = 'Science & Tech';
    } else if (text.includes('mystery') || text.includes('detective') || text.includes('crime')) {
      genre = 'Mystery';
    } else if (text.includes('fantasy') || text.includes('magic') || text.includes('dragon')) {
      genre = 'Fantasy';
    } else if (text.includes('romance') || text.includes('love') || text.includes('relationship')) {
      genre = 'Romance';
    } else if (text.includes('history') || text.includes('historical') || text.includes('biography')) {
      genre = 'History';
    } else if (text.includes('children') || text.includes('kids') || text.includes('young')) {
      genre = 'Children';
    }

    acc[genre] = (acc[genre] || 0) + 1;
    return acc;
  }, {});

  const topGenres = Object.entries(genreStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  const formatActivityTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'checkout': return 'bi-arrow-right-circle text-primary';
      case 'return': return 'bi-arrow-left-circle text-success';
      case 'added': return 'bi-plus-circle text-info';
      case 'updated': return 'bi-pencil-square text-warning';
      default: return 'bi-circle text-muted';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'checkout': return 'primary';
      case 'return': return 'success';
      case 'added': return 'info';
      case 'updated': return 'warning';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" size="lg" />
          <p className="mt-3">Loading dashboard...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Library Management Dashboard</h1>
          <p className="text-muted mb-0">Monitor library operations and manage your collection</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={fetchDashboardData} disabled={isLoading}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </Button>
          <Dropdown>
            <Dropdown.Toggle variant="primary">
              <i className="bi bi-book me-2"></i>
              Book Actions
            </Dropdown.Toggle>
            <Dropdown.Menu align="end">
              <Dropdown.Item onClick={onViewBooks}>
                <i className="bi bi-list me-2"></i>
                View All Books
              </Dropdown.Item>
              <Dropdown.Item onClick={onAddBook}>
                <i className="bi bi-plus-circle me-2"></i>
                Add New Book
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* Key Performance Indicators */}
      <Row className="mb-4">
        <Col lg={3} md={6} className="mb-3">
          <Card className="h-100 border-primary">
            <Card.Body className="text-center">
              <div className="mb-3">
                <i className="bi bi-collection display-4 text-primary"></i>
              </div>
              <h3 className="h2 mb-1">{totalBooks}</h3>
              <p className="text-muted mb-2">Total Titles</p>
              <Badge bg="primary" className="fs-6 px-3 py-1">
                {availableBooks} Available
              </Badge>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6} className="mb-3">
          <Card className="h-100 border-success">
            <Card.Body className="text-center">
              <div className="mb-3">
                <i className="bi bi-check-circle display-4 text-success"></i>
              </div>
              <h3 className="h2 mb-1">{availableBooks}</h3>
              <p className="text-muted mb-2">Available Books</p>
              <ProgressBar
                now={(availableBooks / totalBooks) * 100}
                variant="success"
                className="mt-2"
                style={{ height: '6px' }}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6} className="mb-3">
          <Card className="h-100 border-warning">
            <Card.Body className="text-center">
              <div className="mb-3">
                <i className="bi bi-exclamation-triangle display-4 text-warning"></i>
              </div>
              <h3 className="h2 mb-1">{lowStockBooks + outOfStockBooks}</h3>
              <p className="text-muted mb-2">Need Attention</p>
              <div className="d-flex justify-content-center gap-1">
                <Badge bg="warning">{lowStockBooks} Low</Badge>
                <Badge bg="danger">{outOfStockBooks} Out</Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={3} md={6} className="mb-3">
          <Card className="h-100 border-info">
            <Card.Body className="text-center">
              <div className="mb-3">
                <i className="bi bi-graph-up display-4 text-info"></i>
              </div>
              <h3 className="h2 mb-1">{utilizationRate}%</h3>
              <p className="text-muted mb-2">Utilization Rate</p>
              <small className="text-muted">
                {estimatedCheckedOut} of {totalCopies} copies checked out
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* System Overview + Quick Actions */}
      <Row className="mb-4">
        <Col lg={8} className="mb-3 mb-lg-0">
          <Card>
            <Card.Header>
              <h5 className="mb-0">System Overview</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6} className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-people text-primary me-2"></i>
                    <span>Active Patrons</span>
                  </div>
                  <h4 className="mb-1">{systemStats.totalPatrons}</h4>
                  <small className="text-muted">{systemStats.activeUsers} active this week</small>
                </Col>
                <Col md={6} className="mb-3">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-clock-history text-warning me-2"></i>
                    <span>Overdue Items</span>
                  </div>
                  <h4 className="mb-1">{systemStats.overdueBooks}</h4>
                  <small className="text-muted">Require attention</small>
                </Col>
                <Col md={6}>
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-arrow-left-circle text-success me-2"></i>
                    <span>Returns Today</span>
                  </div>
                  <h4 className="mb-1">{systemStats.returnedToday}</h4>
                  <small className="text-muted">Processed successfully</small>
                </Col>
                <Col md={6}>
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-bar-chart-line text-info me-2"></i>
                    <span>Circulation Rate</span>
                  </div>
                  <h4 className="mb-1">{utilizationRate}%</h4>
                  <small className="text-muted">Collection utilization</small>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>
              <h5 className="mb-0">Quick Actions</h5>
            </Card.Header>
            <Card.Body className="d-grid gap-3">
              <Button
                variant="outline-primary"
                className="d-flex align-items-center justify-content-center"
                onClick={onViewBooks}
              >
                <i className="bi bi-journal-text me-2"></i>
                View All Books
              </Button>
              <Button
                variant="primary"
                className="d-flex align-items-center justify-content-center"
                onClick={onAddBook}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Add New Book
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity and System Status */}
      <Row>
        <Col lg={8}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Recent Activity</h5>
              <Button variant="link" size="sm">View All</Button>
            </Card.Header>
            <Card.Body className="p-0">
              <ListGroup variant="flush">
                {recentActivity.slice(0, 10).map((activity) => (
                  <ListGroup.Item key={activity.id} className="d-flex align-items-center py-3">
                    <div className="me-3">
                      <i className={`bi ${getActivityIcon(activity.type)} fs-5`}></i>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong className="text-truncate d-block" style={{ maxWidth: '200px' }}>
                            {activity.book}
                          </strong>
                          <small className="text-muted">
                            {activity.type} by {activity.user}
                          </small>
                        </div>
                        <div className="text-end">
                          <Badge bg={getActivityColor(activity.type)} className="mb-1">
                            {activity.type}
                          </Badge>
                          <br />
                          <small className="text-muted">
                            {formatActivityTime(activity.timestamp)}
                          </small>
                        </div>
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">System Status</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-flex align-items-center mb-2">
                <i className="bi bi-circle-fill text-success me-2"></i>
                <span>Database: Online</span>
              </div>
              <div className="d-flex align-items-center mb-2">
                <i className="bi bi-circle-fill text-success me-2"></i>
                <span>API: Operational</span>
              </div>
              <div className="d-flex align-items-center mb-2">
                <i className="bi bi-circle-fill text-warning me-2"></i>
                <span>Backups: Due in 2 days</span>
              </div>
              <hr />
              <small className="text-muted">
                Last updated: {new Date().toLocaleTimeString()}
              </small>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default AdminDashboard;
