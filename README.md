# Campus Transit

A campus bus status and disruption reporting system.

## Problem

Students and staff often lack reliable information when campus buses are delayed, break down, or change routes. Inconsistent updates create uncertainty and can cause people to miss classes, meetings, and shifts.

## Solution

Campus Transit provides a shared view of bus routes, schedules, reported service status, estimated arrivals, and disruption history.

- **Students and public users:** View routes and transport updates without signing in.
- **Bus drivers:** Sign in and report delays, breakdowns, detours, and service resumption for their assigned bus.
- **Transport operators:** Publish updates and make transparent corrections.
- **Administrators:** Manage route information and authorized user accounts.
- **Status history:** Retain previous reports so users can understand what changed and when.
- **GPS map:** Display available vehicle coordinates and distinguish simulated movement from genuine device GPS data.

The system is designed to make transport updates clearer and reduce uncertainty during service disruptions.

## Technology

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** SQLite
- **Testing:** Pytest and TypeScript type checking

## Requirements

- Python 3.10 or later
- Node.js 18 or later
- npm

## Setup

Clone the repository and open a terminal in the project directory.

### 1. Install backend dependencies

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### 2. Install frontend dependencies

Run from the repository root:

```powershell
npm install
```

### 3. Start the application

Open two terminals in the repository root.

**Terminal 1 — Backend**

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend**

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

The frontend requires the FastAPI backend to be running for API-backed features. Alternatively, after building the frontend, use the backend-served application if supported by the current configuration.

## Testing

Run the backend test suite:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Run the frontend type check and production build:

```powershell
npm run typecheck
npm run build
```

## Assumptions and limitations

- Route schedules and disruption reports are provided by the application or authorized transport staff.
- Estimated arrival times are based on available schedule and delay information; they are not guaranteed.
- A breakdown may result in an unknown ETA.
- Genuine live tracking requires actual device or vehicle GPS data and permission to access it. Simulated map movement is for demonstration only and must not be presented as genuine live tracking.
- The prototype uses a local SQLite database and is intended for evaluation, not yet as a production campus-wide deployment.
- Integration with external campus transport systems is not assumed unless a verified API is available.

## Project Structure

- `main.py` — FastAPI application and backend logic
- `frontend/` — React and TypeScript application
- `tests/` — Automated backend tests
- `requirements.txt` — Python dependencies
- `package.json` — Frontend workspace scripts and dependencies
- `.env.example` — Example environment configuration, if required
