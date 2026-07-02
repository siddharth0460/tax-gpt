# 🧾 AI Tax Copilot

An intelligent Indian income tax calculator and saving strategy generator powered by RAG (Retrieval-Augmented Generation). It parses the actual Income Tax Act PDFs, extracts deduction limits using AI, and generates personalized tax-saving recommendations.

## Features

- **Dual Regime Comparison** — Automatically calculates tax under both Old and New regimes and recommends the better option
- **RAG-Powered Rules** — Tax rules are extracted directly from the Income Tax Act 1961 and the new Direct Tax Code 2025 PDFs using a Groq LLM
- **Section-Level Deductions** — Supports 80C, 80D, 80CCD(1B), 80CCD(2), 80E, 80TTA, 80G, 24(b), and HRA
- **AI Advisor** — Generates a natural-language explanation of your tax situation and savings opportunities
- **Marginal Relief** — Correctly applies Section 87A marginal relief under the new tax regime
- **Smart Caching** — Multi-tier cache (memory → disk → RAG extraction → static fallback) ensures sub-second API responses

## Architecture

```
tax/
├── backend/                      # FastAPI + Python
│   ├── main.py                   # App entrypoint with CORS
│   ├── ingest_rules.py           # PDF → JSON Page Index pipeline
│   ├── requirements.txt
│   ├── .env                      # GROQ_API_KEY
│   ├── data/
│   │   ├── source_pdfs/          # Income Tax Act PDFs
│   │   ├── index/                # Generated JSON Page Indices
│   │   ├── cache/                # LLM extraction cache
│   │   ├── old_regime_rules.json # Static fallback rules
│   │   └── new_regime_rules.json
│   └── app/
│       ├── api/routes/
│       │   └── tax_saver.py      # API endpoints
│       └── services/
│           ├── ingestion/        # PDF parser + text chunker
│           ├── reasoning/        # Tax calculator + AI explainer
│           └── retrieval/        # RAG service (Page Index + Groq)
│
└── frontend/                     # Next.js + React
    └── src/app/page.tsx          # Tax form UI
```

## How It Works

1. **Ingestion** — `ingest_rules.py` parses the Income Tax Act PDFs into semantic chunks and saves them as JSON Page Indices (no vector database needed)
2. **Retrieval** — When tax rules are needed, the system does a fast keyword search on the JSON index to find relevant legal text chunks
3. **Extraction** — The Groq LLM (llama-3.3-70b) reads the legal text and extracts structured deduction limits as JSON
4. **Calculation** — Pure arithmetic: applies tax slabs, deductions, rebates, cess, and marginal relief deterministically
5. **Explanation** — A separate LLM call generates a human-readable summary of the results

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- A [Groq API key](https://console.groq.com/)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
echo "GROQ_API_KEY=your_key_here" > .env

# Ingest the tax PDFs (one-time, ~15 seconds)
python ingest_rules.py --regime old
python ingest_rules.py --regime new

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tax-strategy/` | Generate a full tax strategy from form data |
| `POST` | `/api/tax-strategy/refresh-rules` | Re-extract rules from Page Index (after re-ingestion) |
| `GET`  | `/api/tax-strategy/cache-status` | Check if RAG cache is populated |
| `GET`  | `/health` | Health check |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, TypeScript |
| Backend | FastAPI, Python |
| LLM | Groq (llama-3.3-70b-versatile, qwen3-32b) |
| PDF Parsing | PyMuPDF, pdfplumber |
| RAG | Keyword-based Page Index (no vector DB) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key for LLM calls |

## License

This project is for educational and personal use.
