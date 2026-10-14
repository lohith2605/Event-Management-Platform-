# Smart Event Management Platform

A full-stack web application foundation for a Smart Event Management Platform, built with JavaScript, React + Vite, Node.js, Express, and MongoDB with Mongoose.

---

## 📁 Project Structure

```text
smart-event-platform/
├── frontend/             # React + Vite application
│   ├── src/
│   │   ├── App.jsx       # Foundation verification UI
│   │   ├── App.css       # Foundation styling
│   │   ├── main.jsx      # React entry point
│   │   └── ...
│   ├── .env.example      # Frontend environment variable template
│   ├── vite.config.js    # Vite configuration with /api proxy to backend
│   └── package.json
│
├── backend/              # Node.js + Express API (ES modules)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js     # MongoDB / Mongoose connection handler
│   │   ├── middlewares/
│   │   │   └── errorHandler.js # Centralized 404 & error handlers
│   │   ├── routes/
│   │   │   └── health.js # GET /api/health route
│   │   ├── app.js        # Express app, CORS, JSON parsing, middleware
│   │   └── server.js     # Server entry point & listener
│   ├── .env.example      # Backend environment variable template
│   └── package.json
│
├── .gitignore            # Git ignore rules for node_modules, build outputs, and env files
├── package.json          # Root scripts to run and install packages
└── README.md             # Project documentation & setup instructions
```

---

## ⚙️ Prerequisites

- **Node.js**: `v18+` (v20+ or v24+ recommended)
- **npm**: `v9+`
- **MongoDB**: Local MongoDB instance or MongoDB Atlas connection string (optional for health check)

---

## 🚀 Setup & Installation

### 1. Clone & Enter the Repository
```bash
git clone https://github.com/lohith2605/Event-Management-Platform-.git
cd Event-Management-Platform-
```

### 2. Install Dependencies

You can install all dependencies from the root directory:
```bash
npm run install:all
```

Or install them individually:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## 🔑 Environment Variables

### Backend Configuration
Copy the template file to `.env` in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Define the following environment variables in `backend/.env`:
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the Express API server | `5000` |
| `NODE_ENV` | Application environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/smart-event-platform` |
| `CORS_ORIGIN` | Allowed origin for frontend requests | `http://localhost:5173` |

### Frontend Configuration
Copy the template file in `frontend/` (if customized):
```bash
cp frontend/.env.example frontend/.env
```

| Variable | Description |
| :--- | :--- |
| `VITE_API_BASE_URL` | Optional custom API base URL (Vite proxy handles `/api` by default) |

---

## 💻 Running the Application

### Option A: From the Root Directory

- **Run backend in watch mode:**
  ```bash
  npm run dev:backend
  ```

- **Run frontend development server:**
  ```bash
  npm run dev:frontend
  ```

### Option B: From Individual Directories

- **Start Backend:**
  ```bash
  cd backend
  npm run dev
  ```
  The API server runs at `http://localhost:5000`.

- **Start Frontend (in a separate terminal):**
  ```bash
  cd frontend
  npm run dev
  ```
  The Vite development server runs at `http://localhost:5173`.

---

## 🔍 How to Verify the Foundation

1. **Verify Backend Health Endpoint:**
   - Open a browser or run:
     ```bash
     curl http://localhost:5000/api/health
     ```
   - Expected JSON response:
     ```json
     {
       "status": "ok",
       "message": "Smart Event Management Platform API is running",
       "timestamp": "...",
       "environment": "development",
       "database": "disconnected" // or "connected" if MongoDB is active
     }
     ```

2. **Verify Frontend & Vite Proxy:**
   - Navigate to `http://localhost:5173`.
   - The confirmation dashboard will show:
     - Frontend status: **Running**
     - Backend API status: **Connected** (queried via `/api/health` proxy)
     - Live response payload from the backend.

---

## 🛡️ Implemented Foundation Features

- **React + Vite**: Fast modern dev build with HMR and modular UI.
- **Node.js + Express (ES Modules)**: Native `import/export` syntax.
- **Vite Proxy**: Transparently proxies `/api/*` from `http://localhost:5173` to `http://localhost:5000`.
- **JSON & Body Parsing**: Configured with `express.json()` and `express.urlencoded()`.
- **Development CORS**: Preconfigured for `http://localhost:5173`.
- **Centralized Error Handling**: Unified 404 handler and global error middleware.
- **Mongoose Database Hook**: Modular MongoDB connection ready for upcoming schemas.
