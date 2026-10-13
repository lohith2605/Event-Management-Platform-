# 🎪 Event Management Platform

A modern, full-stack platform designed to streamline event planning, ticket booking, attendee management, and real-time event analytics. Built for organizers, attendees, and administrators.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
  - [For Attendees](#for-attendees)
  - [For Organizers](#for-organizers)
  - [For Administrators](#for-administrators)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
- [API Endpoints](#-api-endpoints)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

## 📖 Overview

The **Event Management Platform** is an end-to-end web application that simplifies the lifecycle of managing events—from hosting conferences, hackathons, and webinars to concerts and workshops. It provides users with an intuitive interface to discover and register for events, while empowering organizers with robust management, ticketing, and analytics tools.

---

## ✨ Key Features

### For Attendees
- 🔍 **Event Discovery & Filtering:** Browse events by category, date, venue, price, or location with real-time search.
- 🎟️ **Ticket Booking & Checkout:** Secure reservation flow with instant e-ticket generation and unique QR codes.
- 📅 **Schedule & Calendar Sync:** Add booked events directly to Google Calendar or iCal.
- 🔔 **Notifications & Reminders:** Automated email alerts for upcoming events and ticket confirmations.
- ⭐ **Reviews & Ratings:** Share feedback and ratings for attended events.

### For Organizers
- 📝 **Event Creation & Publishing:** Multi-step event creation wizard (banner upload, descriptions, speaker list, schedule, tiers).
- 🎫 **Tiered Ticketing:** Support for Early Bird, General Admission, VIP, and Free passes with custom capacities.
- 📲 **QR Code Check-in:** In-app check-in scanner for fast on-site verification.
- 📊 **Real-Time Analytics Dashboard:** Track registrations, ticket revenue, page views, and attendance rates.
- 📢 **Attendee Communication:** Broadcast announcements or updates to all registered attendees.

### For Administrators
- 🛡️ **Role-Based Access Control (RBAC):** Admin, Organizer, and Attendee role management.
- 📋 **Event Moderation:** Review, approve, or flag public event listings.
- 💰 **Payouts & Platform Fees:** Oversee platform transactions and dispute resolutions.
- 📈 **System Overview:** Platform-wide metrics, active user stats, and audit logs.

---

## 🛠 Tech Stack

| Layer | Recommended / Default Stack | Alternatives |
| :--- | :--- | :--- |
| **Frontend** | React / Next.js, HTML5, CSS3 / Tailwind CSS | Vue.js, Angular |
| **Backend** | Node.js (Express.js) | Python (FastAPI / Django), Go |
| **Database** | MongoDB / PostgreSQL | MySQL |
| **Authentication** | JWT & OAuth 2.0 (Google / GitHub) | NextAuth, Firebase Auth |
| **Payments** | Stripe / Razorpay | PayPal |
| **Storage** | Cloudinary / AWS S3 (for event banners & QR codes) | Firebase Storage |
| **Email/Messaging** | Nodemailer / SendGrid | Resend, Twilio |

---

## 🏛 System Architecture

```mermaid
graph TD
    User([User / Browser]) --> Frontend[Frontend Client (Next.js / React)]
    Frontend --> API[RESTful API / Backend Gateway]
    
    API --> Auth[Auth Service (JWT / OAuth)]
    API --> Events[Event & Ticket Service]
    API --> Payment[Payment Gateway (Stripe / Razorpay)]
    API --> Notifications[Email Notification Service]
    
    Events --> DB[(Primary Database: PostgreSQL / MongoDB)]
    Events --> Storage[Media Storage (S3 / Cloudinary)]
    Payment --> DB
```

---

## 📂 Project Structure

A suggested scalable modular structure:

```text
Event-Management-Platform/
├── client/                     # Frontend Application
│   ├── public/                 # Static assets & icons
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Modal, EventCard, etc.)
│   │   ├── pages/              # Application pages / views
│   │   ├── hooks/              # Custom React hooks
│   │   ├── context/            # Global state management
│   │   ├── services/           # API call services
│   │   └── styles/             # Global stylesheets
│   └── package.json
│
├── server/                     # Backend Application
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── models/             # Database schemas / models
│   │   ├── routes/             # API routes
│   │   ├── middlewares/        # Auth, validation, error handlers
│   │   ├── utils/              # Helper utilities (QR generator, emailer)
│   │   └── config/             # DB & environment configs
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- MongoDB / PostgreSQL instance (local or hosted like MongoDB Atlas / Supabase)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lohith2605/Event-Management-Platform-.git
   cd Event-Management-Platform-
   ```

2. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Environment Variables

Create a `.env` file in the `server` directory (referencing `.env.example`):

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Payment Gateway (Optional / Staging)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Cloudinary / S3 (For Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
```

### Running the Application

1. **Start the backend server:**
   ```bash
   cd server
   npm run dev
   ```
   Server will run on `http://localhost:5000`.

2. **Start the frontend application:**
   ```bash
   cd ../client
   npm run dev
   ```
   Client will run on `http://localhost:3000`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Register new user account | Public |
| **POST** | `/api/auth/login` | Authenticate user & receive token | Public |
| **GET** | `/api/events` | List all published events (supports filter & search) | Public |
| **GET** | `/api/events/:id` | Get detailed event info | Public |
| **POST** | `/api/events` | Create a new event listing | Organizer / Admin |
| **PUT** | `/api/events/:id` | Update an existing event | Organizer / Admin |
| **DELETE**| `/api/events/:id` | Delete or cancel an event | Organizer / Admin |
| **POST** | `/api/bookings` | Book tickets for an event | Attendee |
| **GET** | `/api/bookings/my-tickets`| View user's booked tickets | Attendee |
| **POST** | `/api/checkin/verify` | Verify ticket QR code during check-in | Organizer / Admin |
| **GET** | `/api/analytics/dashboard` | Fetch event sales and attendee metrics | Organizer / Admin |

---

## 🗺 Roadmap

- [ ] Interactive seat mapping selection
- [ ] Live chat & Q&A during virtual events
- [ ] Multi-currency payment processing
- [ ] Progressive Web App (PWA) support with offline ticket access
- [ ] AI-powered event recommendations

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👤 Author

- **Lohith** - [@lohith2605](https://github.com/lohith2605)
- Repository: [Event-Management-Platform-](https://github.com/lohith2605/Event-Management-Platform-.git)
