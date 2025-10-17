## Library Management System

Modern web app for managing a small library with user authentication, book catalog management, and patron checkout/return flows.

### Overview

- **Frontend**: React 18 (Create React App), React-Bootstrap, Bootstrap Icons
- **Backend**: Node.js, Express 5, MySQL via Google Cloud SQL Connector
- **Auth**: JWT-based signup/login with roles (admin, patron)
- **Data**: MySQL tables for users, books, active checkouts, and checkout history

### Features

- **Authentication**
  - Signup with username, email, and password (8+ chars)
  - Optional admin signup via `ADMIN_INVITE_CODE`
  - Login with username or email
  - JWT-based session; `/api/auth/me` to fetch current user

- **Admin (catalog management)**
  - List all books
  - View single book
  - Create book (title, author, isbn, description, page_count, copies)
  - Update book
  - Delete book

- **Patron (borrowing)**
  - Browse/search/filter books (client-side search by title/author/description)
  - Add books to a local “checkout bag” (UI guard: up to 3 total, 1 copy per title)
  - Submit checkout: server enforces rules transactionally
    - Max 3 active checkouts per user
    - Max 1 copy per title per user
    - Decrements `available_copies` atomically
  - Return books: moves record to history and increments `available_copies`

- **UX niceties**
  - Responsive UI with cards, modals
  - Light/Dark mode toggle
  - Basic stats tiles (admin)

### Tech Stack

- React 18, React-Bootstrap, Bootstrap Icons
- Express 5, `mysql2/promise`, `@google-cloud/cloud-sql-connector`
- `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`

### Project Structure

```
LibraryManagementSystem/
  server.js                 # Express API (JWT auth, books, checkout/return)
  test.js                   # Helper script: prints users table rows (non-sensitive fields)
  package.json              # Backend deps and start script
  client/
    package.json            # CRA app; dev proxy to http://localhost:3001
    public/
      index.html            # Includes Bootstrap Icons
    src/
      api/auth.js           # Auth API client (signup, login, me, token utils)
      App.js                # Main UI (auth, catalog, bag, modals, admin tools)
```

### Prerequisites

- Node.js 18+
- A MySQL instance
  - Recommended: Google Cloud SQL for MySQL (uses Cloud SQL Connector)
  - Local MySQL is possible, but current server is configured for Cloud SQL connector options. To use local MySQL, you would adapt `server.js` pool creation accordingly.

### Environment Variables (server)

Create a `.env` file in the repository root (same folder as `server.js`):

```
# Google Cloud SQL instance connection name: <PROJECT>:<REGION>:<INSTANCE>
INSTANCE_CONNECTION_NAME=your-project:your-region:your-instance

# Database credentials (user must exist on the instance)
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=library_db

# JWT secret for signing access tokens
JWT_SECRET=replace-with-a-strong-random-secret

# Optional: required invite code to allow admin signups
ADMIN_INVITE_CODE=optional-admin-code

# If using service account locally, set Google ADC file path
# GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\service-account.json
```

Notes:
- The Cloud SQL Connector uses Google Application Default Credentials. On local machines, set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON with Cloud SQL Client permissions.
- Server listens on port `3001`.

### Environment Variables (client)

Create `client/.env` (optional):

```
# Defaults to http://localhost:3001 if not set
REACT_APP_API_BASE_URL=http://localhost:3001
```

The CRA `proxy` in `client/package.json` already forwards `/api` calls to `http://localhost:3001` during `npm start`.

### Database Schema

On startup the server will ensure the `users` table exists and add missing columns/indexes if needed. Create the remaining tables manually with SQL below.

```sql
-- books: catalog
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  description TEXT,
  page_count INT,
  total_copies INT NOT NULL,
  available_copies INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- active_checkouts: current loans
CREATE TABLE IF NOT EXISTS active_checkouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  checkout_date DATETIME NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_active_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_active_book FOREIGN KEY (book_id) REFERENCES books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- checkout_history: past returns
CREATE TABLE IF NOT EXISTS checkout_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  checkout_date DATETIME NOT NULL,
  return_date DATETIME NOT NULL,
  CONSTRAINT fk_hist_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_hist_book FOREIGN KEY (book_id) REFERENCES books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Running Locally

1) Install backend dependencies (from repo root):

```
npm install
```

2) Start the API server (port 3001):

```
npm start
```

3) Install frontend dependencies:

```
cd client
npm install
```

4) Start the React app (port 3000, proxies `/api` to 3001):

```
npm start
```

Then open the client at `http://localhost:3000`.

### API Reference (summary)

- Auth
  - `POST /api/auth/signup` — body: `{ username, email, password, role?, adminInviteCode? }` → `{ user, token }`
  - `POST /api/auth/login` — body: `{ usernameOrEmail, password }` → `{ user, token }`
  - `GET /api/auth/me` — header: `Authorization: Bearer <token>` → `{ user }`

- Books (admin-intended)
  - `GET /api/books` → `Book[]`
  - `GET /api/books/:id` → `Book`
  - `POST /api/books` — body: `{ title, author, isbn, description, page_count, copies }` → `Book`
  - `PUT /api/books/:id` — body: same as POST → `Book`
  - `DELETE /api/books/:id` → 204

- Patron
  - `GET /api/patron/checkouts/:userId` → current checkouts joined with book details
  - `POST /api/patron/checkout` — body: `{ userId, bookId }` (transactional, applies server-side rules)
  - `POST /api/patron/return` — body: `{ userId, bookId }` (moves to history, increments stock)

Book payload shape (API responses):

```
{
  id: number,
  title: string,
  author: string,
  isbn: string,
  description: string,
  page_count: number,
  copies: number  // maps to available_copies
}
```

### Security Notes

- Passwords are stored as bcrypt hashes (`password_hash`).
- JWT access tokens are signed with `JWT_SECRET` (7 day expiration).
- The UI implements role-based controls, but the API endpoints currently do not enforce admin-only access on book mutations. Do not expose this API publicly without adding server-side RBAC middleware.

### Known Limitations

- The client uses a placeholder `userId` for checkout/return flows. Integrating `GET /api/auth/me` on the client to derive `userId` is recommended.
- Server initializes only the `users` table automatically; other tables require manual creation (SQL provided above).
- No refresh tokens; a simple access-token-only flow.
- No pagination on `GET /api/books`.

### Scripts

- Backend (root `package.json`):
  - `npm start` — runs `node server.js`

- Frontend (`client/package.json`):
  - `npm start` — CRA dev server with proxy
  - `npm run build` — production build
  - `npm test` — CRA tests

### Troubleshooting

- Cloud SQL connector errors: ensure `INSTANCE_CONNECTION_NAME` and ADC (`GOOGLE_APPLICATION_CREDENTIALS`) are set, and the service account has Cloud SQL Client role. Verify DB user/password and `DB_NAME` exist.
- CORS issues: server enables `cors()` for all origins by default; confirm requests target the correct base URL.
- Auth errors: ensure `JWT_SECRET` is set; check password length and email format.

### License

This project is provided as-is without a specified license. Add a license file if you plan to distribute.


