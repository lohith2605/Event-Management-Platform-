# 🎉 UTSAV — Smart Event Management Platform

A full-stack event management and ticket booking platform where attendees discover events, organizers manage events, and administrators oversee approvals — with secure payments, digital tickets, and real-time chat.

**Built with:** React 19 · Vite · Node.js · Express · MongoDB Atlas · Socket.IO

## ✨ Features

- **Event Discovery:** Search and filter events by category, city, and date.
- **Event Management:** Create events, manage ticket types, and track registrations.
- **Admin Approval:** Review event submissions and notify organizers by email.
- **Ticket Booking:** Temporary ticket reservations, coupons, and Razorpay payment integration.
- **Digital Tickets:** QR-code tickets and event check-in scanning.
- **Secure Authentication:** JWT-based authentication, Google sign-in, role-based access, session management, and TOTP-based two-factor authentication.
- **Real-Time Chat:** Private attendee–organizer conversations and admin–organizer support.
- **Notifications:** In-app alerts, unread counts, and booking updates.
- **Analytics & Reviews:** Event performance insights and attendee feedback.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, Firebase Authentication, TOTP 2FA |
| Real-time | Socket.IO |
| Payments | Razorpay |
| Email | Nodemailer |
| Tickets | QR-code generation and scanning |

## 👥 User Roles

- **Attendee:** Discover events, book tickets, access QR tickets, and contact organizers for eligible bookings.
- **Organizer:** Create and manage events, monitor bookings, scan tickets, and communicate with attendees and admins.
- **Admin:** Review event submissions, manage platform operations, and communicate with organizers.

## 🏗️ Project Structure

```text
Event-Management-Platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── scripts/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       └── pages/
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas or a local MongoDB instance

### 1. Clone the repository

```bash
git clone https://github.com/lohith2605/Event-Management-Platform-.git
cd Event-Management-Platform-
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Configure environment variables

Create the backend and frontend environment files using the provided templates:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Configure the required MongoDB connection, authentication secrets, email service, and any integrations you intend to use. Add valid Razorpay and Firebase credentials when testing those features.

**Never commit `.env` files, passwords, API secrets, or private keys.**

### 4. Initialize the application

Run the available setup scripts if required:

```bash
npm --prefix backend run setup:admin
npm --prefix backend run seed:events
```

### 5. Start the application

Run each command in a separate terminal:

**Backend**

```bash
npm run dev:backend
```

**Frontend**

```bash
npm run dev:frontend
```

Open **http://localhost:5173** in your browser.

## 🧪 Testing

Run the available automated test suites:

```bash
node backend/scripts/test_event_chat_phase1.js
node backend/scripts/test_chat_frontend_integration.js
node backend/scripts/test_event_approval_email.js
node backend/scripts/test_2fa_full_suite.js
node backend/scripts/test_session_management.js
```

Build the frontend:

```bash
npm run build:frontend
```

Run the frontend linter:

```bash
npm --prefix frontend run lint
```

## 🔐 Security Highlights

- HTTP-only authentication cookies and server-managed sessions.
- Role-based authorization and protected API endpoints.
- Two-factor authentication with recovery codes.
- Server-side payment signature verification.
- Atomic ticket reservation holds to reduce overselling.
- Event-specific chat authorization and private conversation access.
- Input validation and rate limiting.

---

**UTSAV — Discover events. Book experiences. Connect with organizers.**
