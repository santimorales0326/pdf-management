# PDF Nexus

PDF Nexus is a secure, local web application designed to manage and manipulate PDF files. It performs all operations (unlocking, splitting, merging, and compression) completely in-memory, ensuring that your sensitive documents never touch persistent storage or external cloud services.

## Core Features

- **Unlock PDF**: Remove passwords from encrypted PDF documents.
- **Split PDF**: Extract specific page ranges from a PDF. If multiple ranges are specified, they are automatically packaged into a single ZIP file.
- **Merge PDFs**: Concatenate multiple PDF files in any custom order.

- **Compress PDF**: Losslessly compress PDF page streams without reducing image quality. Download includes a before-and-after size summary in the app. Already optimized PDFs are returned unchanged if compression cannot save space. Unlock encrypted PDFs first.

---

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: FastAPI, PyPDF
- **Security**: In-memory PDF processing using python's `io.BytesIO`

---

## Getting Started

### 1. Prerequisites
- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/en/download/)

### 2. Run the Backend (FastAPI)
Open a terminal in the root directory and run the following commands:
```powershell
# Navigate to the backend directory
cd backend

# Activate the virtual environment
.venv\Scripts\activate

# Start the development server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
The API documentation will be available at `http://127.0.0.1:8000/docs`.

### 3. Run the Frontend (Next.js)
Open another terminal in the root directory and run:
```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies (if not already installed)
pnpm install

# Run the development server
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.

---

## Implementation Details

All PDF manipulations are executed using `pypdf` which processes files as byte streams (`io.BytesIO`). This guarantees that:
1. No temporary folders/files are created on the server's hard drive.
2. File data exists only in volatile memory during the HTTP request lifecycle.
3. PDF payloads are immediately garbage collected after the request finishes.
