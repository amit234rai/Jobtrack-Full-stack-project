# JobTrack - Job Application Tracker

A full-stack web application for managing job applications with automated interview reminders, role-based access control, and comprehensive application tracking.

<img width="940" height="529" alt="image" src="https://github.com/user-attachments/assets/0849814c-8211-4146-913d-cf7913b42cb4" />

<img width="940" height="529" alt="image" src="https://github.com/user-attachments/assets/638065da-a549-4cd7-8027-a606b2bda355" />



## 🚀 Features

- **Application Management** - Track job applications through Saved, Applied, Online assessment, Interview, Offer, and Rejected stages
- **Interview Scheduling** - Schedule interviews with queued reminders; the default lead time is 30 minutes
- **Dashboard Analytics** - Real-time metrics showing application status distribution and upcoming interviews
- **Notes & History** - Add notes and view complete status change history for each application
- **Search & Filter** - Quick search across job titles and companies
- **Authentication** - Secure JWT-based auth with bcrypt password hashing
- **Password Recovery** - OTP-based password reset via email
- **Background Jobs** - BullMQ worker and transactional outbox for interview reminders

## 🛠️ Tech Stack

**Frontend**

- React 18 with Vite
- Vanilla CSS (responsive design)
- Fetch API for HTTP requests

**Backend**

- Node.js with Express
- PostgreSQL 16 (relational database)
- Redis 7 (caching and job queue)
- BullMQ (background job processing)
- Zod (input validation)
- Bcrypt (password hashing)
- JWT (authentication)
- Nodemailer (email notifications)

**DevOps**

- Docker Compose (multi-container orchestration)
- Health checks for PostgreSQL and Redis containers
- SQL schema initialization on fresh PostgreSQL volumes

## 📦 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Installation

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd PROJECT
```

2. **Set up environment variables**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and update:

- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Email credentials (if using real email)

3. **Start all services**

```bash
docker-compose up --build
```

4. **Access the application**

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/health

### Database Schema

The database initializes from the SQL files in `backend/src/db/migrations/` only when PostgreSQL starts with an empty data volume. Existing volumes must be migrated deliberately before schema changes are deployed.

**Tables:**

- `users` - User accounts with applicant/admin roles
- `companies` - Normalized employer names
- `jobs` - Job postings with company information
- `applications` - User job applications with status tracking
- `resume_versions` - User-owned resume links and active-version state
- `interviews` - Scheduled interviews with reminder tracking
- `notes` - Free-form notes attached to applications
- `application_status_history` - Complete audit log of status changes
- `outbox_events` - Transactional outbox pattern for reliable job processing

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐
│   Frontend  │────────▶│   Backend    │
│   (React)   │         │   (Express)  │
└─────────────┘         └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼────┐ ┌──▼────┐ ┌──▼─────┐
              │PostgreSQL│ │ Redis │ │ Worker │
              │          │ │       │ │(BullMQ)│
              └──────────┘ └───────┘ └────────┘
```

**Key Design Patterns:**

- RESTful API architecture
- Middleware chain (auth → validation → handler → error)
- Transactional outbox pattern for reliable background jobs
- Redis caching with invalidation strategy
- Container health checks for PostgreSQL and Redis; the API `/health` endpoint verifies PostgreSQL

## 🔐 Security Features

- Password hashing with bcrypt (salt rounds: 12)
- JWT tokens with configurable expiration (default 7 days)
- Rate limiting on authentication endpoints (30 requests per 15 minutes per IP)
- Helmet.js for security headers
- CORS configuration
- Constant-time comparison for login (prevents timing attacks)
- SQL injection prevention via parameterized queries
- Input validation with Zod schemas

## 📝 API Endpoints

### Authentication

- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login and receive JWT token
- `POST /auth/forgot-password` - Request password reset OTP
- `POST /auth/reset-password` - Reset password with OTP
- `GET /auth/me` - Return the authenticated user

### Jobs & Applications

- `GET /jobs` - List the newest jobs
- `POST /jobs` - Create new job posting
- `POST /jobs/import` - Import a validated batch of jobs
- `GET /applications` - List user's applications (with filters)
- `POST /applications` - Save a job to your board
- `POST /applications/with-job` - Atomically create a company, job, and saved application
- `PATCH /applications/:id/status` - Update application status
- `PATCH /applications/:id/resume` - Attach or clear the active resume version
- `GET /applications/:id` - Get application details

### Interviews & Notes

- `POST /applications/:id/interviews` - Schedule interview
- `POST /applications/:id/notes` - Add note
- `GET /dashboard` - Get user dashboard metrics

### Resumes

- `GET /resumes` - List the authenticated user's resume links
- `POST /resumes` - Create a resume link
- `PATCH /resumes/:id/activate` - Mark a resume as active

### Admin

- `GET /admin/admin-only` - Admin access verification (admin only)

## 🧪 Testing

Run tests with:

```bash
cd backend
npm test
```

Tests cover:

- Input validation schemas (Zod)
- Resume service logic
- Outbox service logic
- HTTP integration tests for auth, applications, status changes, notes, dashboard, and health — skip when no database is available

---

**Built by Amit Rai**

🔗 [Portfolio](https://portfolio-website-phi-orcin-89.vercel.app/) | [LinkedIn](https://www.linkedin.com/in/amit-rai-ucs1677)
