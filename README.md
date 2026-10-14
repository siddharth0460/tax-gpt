# 🛡️ TaxCopilot — Indian Income Tax Planner & Strategy Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.12+-yellow?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Tests: 16 Passing](https://img.shields.io/badge/Tests-16%20Passing-brightgreen?style=flat-square)](backend/tests/)

**TaxCopilot** is an enterprise-grade Indian income tax calculator, regime comparator, and AI-driven optimization copilot built for **FY 2025–26 (Assessment Year 2026–27)**. It deterministically computes tax liabilities under both the Old and New Tax Regimes (Section 115BAC), evaluates deduction headroom across Chapter VI-A, and pairs pure mathematical precision with Groq-powered reasoning explanations.

---

## ✨ Features

- **Dual Regime Comparison** — Real-time side-by-side computation of Old Regime vs. New Regime tax liabilities to recommend the optimal regime with exact net rupee savings.
- **FY 2025–26 Statutory Rules**:
  - **New Regime**: Standard deduction of **₹75,000**, Section 87A rebate for taxable incomes up to **₹12,00,000** (zero tax), and automated **Section 87A Marginal Relief** for incomes between ₹12L and ₹12.75L.
  - **Old Regime**: Standard deduction of **₹50,000**, age-bracket exemption slabs (General: ₹2.5L, Senior 60+: ₹3L, Super Senior 80+: ₹5L), and Section 87A rebate up to **₹5,00,000**.
- **Chapter VI-A Deductions**:
  - Section 80C (capped at ₹1,50,000)
  - Section 80D (Self, Family, and Senior Citizen Parents)
  - Section 80CCD(1B) (additional ₹50,000 for self NPS)
  - Section 80CCD(2) (Employer NPS contribution: 10% private / 14% govt)
  - Section 80E (Uncapped interest on higher education loans)
  - Section 24(b) (Home loan interest capped at ₹2,00,000)
  - Section 80TTA / 80TTB (Savings interest deductions)
  - House Rent Allowance (HRA) statutory exemption u/s 10(13A) with Metro (50%) and Non-Metro (40%) rule evaluation.
- **High-Income Surcharge & Marginal Relief** — Multi-tier surcharge (10%, 15%, 25%, 37%) with statutory marginal relief and the 25% surcharge cap under the New Regime.
- **RAG-Powered Rules Engine** — Legal text parsed from official Income Tax Act PDFs into semantic Page Indices, enabling zero-vector-db keyword retrieval and dynamic rule extraction.
- **Multi-Tier Smart Caching** — In-memory caching → on-disk caching → static fallback ensure sub-10ms computation endpoints.
- **User Authentication & Cloud History** — Secure registration, login, Google OAuth integration, password reset via standard SMTP (Gmail/SendGrid), and a slide-over history drawer to track scenarios across sessions.
- **Modern Responsive UI** — Dark/light theme support, clean typography, keyboard navigation, print/PDF export styling, and professional empty/loading states.

---

## 🏗️ Architecture

```
tax/
├── backend/                        # FastAPI Python service
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── auth.py             # User registration, login, OAuth, password reset
│   │   │   └── tax_saver.py        # Strategy calculation & user history endpoints
│   │   └── services/
│   │       ├── email_service.py    # SMTP email dispatch & console fallback
│   │       ├── reasoning/
│   │       │   ├── strategy_generator.py   # Deterministic tax calculations
│   │       │   └── explanation_service.py  # LLM advisory generator
│   │       ├── retrieval/          # RAG Page Index rule retrieval
│   │       └── ingestion/          # PDF text parsing & semantic chunking
│   ├── data/
│   │   ├── old_regime_rules.json   # Verified fallback rules for Old Regime
│   │   └── new_regime_rules.json   # Verified fallback rules for New Regime
│   ├── tests/
│   │   └── test_taxcopilot.py      # End-to-end regression test suite (16 tests)
│   ├── main.py                     # App entry point, CORS middleware, cache warming
│   ├── requirements.txt            # Python dependencies
│   └── .env.example                # Sample backend environment configuration
│
└── frontend/                       # Next.js 16 Web Application
    ├── src/
    │   ├── app/
    │   │   ├── auth/page.tsx       # Sign in, Sign up, Forgot password UI
    │   │   ├── privacy/page.tsx    # Privacy policy route
    │   │   ├── terms/page.tsx      # Terms & disclaimer route
    │   │   ├── layout.tsx          # Root layout & providers
    │   │   └── page.tsx            # Main calculator & comparison dashboard
    │   ├── components/             # Reusable UI widgets & modals
    │   │   ├── HistoryDrawer.tsx   # Slide-over saved calculations drawer
    │   │   ├── HelpModal.tsx       # Reference tax guide modal
    │   │   ├── SettingsModal.tsx   # Slabs & parameters inspection modal
    │   │   └── UserProfileMenu.tsx # Profile avatar & account management
    │   └── context/
    │       └── AuthContext.tsx     # Client-side auth provider & session state
    ├── package.json
    └── .env.example                # Sample frontend environment configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Python**: 3.12 or newer
- **Node.js**: 18.x or newer (npm or pnpm)
- **Groq API Key**: (Free) from [console.groq.com](https://console.groq.com/)

---

### Backend Setup

1. **Navigate to the backend directory and set up a virtual environment:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and supply your `GROQ_API_KEY`. (SMTP configuration is optional; if omitted, password reset links log to the console).*

4. **Launch the backend server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *API Swagger documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).*

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   *`NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`.*

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Automated Testing

TaxCopilot includes a comprehensive automated test suite verifying reference test cases, edge cases, input sanitization, marginal relief, auth lifecycles, and currency formatting:

```bash
# From the project root with the backend venv active:
backend/venv/bin/python -m unittest backend/tests/test_taxcopilot.py
```

### Test Suite Highlights
- ✅ **Case 1 & 2**: Multi-component salary + Metro/Non-metro HRA rule binding.
- ✅ **Case 3**: Section 80E uncapped education loan interest saving.
- ✅ **Case 4**: Section 87A rebate cliff at ₹5,00,000 in Old Regime.
- ✅ **Case 5 & 6**: Section 87A rebate at ₹12,00,000 and Marginal Relief proviso at ₹12,00,001 in New Regime.
- ✅ **Case 7 & 8**: Zero and negative input sanitization (non-negative clamping).
- ✅ **Case 9 & 10**: Senior (60+) / Super Senior (80+) exemption slabs and standard deduction salary capping.
- ✅ **Case 11**: Surcharge calculations on incomes > ₹5 Crore with New Regime 25% cap.
- ✅ **Auth & History**: User registration, duplicate checks, login, forgot password, history item deletion.

---

## 📡 API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/tax-strategy/` | Compute tax under Old & New regimes and get AI strategy |
| `GET` | `/api/tax-strategy/history` | Retrieve saved calculations for the current user |
| `POST` | `/api/tax-strategy/history` | Persist a calculation to user history |
| `DELETE` | `/api/tax-strategy/history/{id}` | Delete a specific calculation from history |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate with email and password |
| `POST` | `/api/auth/google` | Authenticate with Google OAuth credential |
| `POST` | `/api/auth/forgot-password` | Generate & dispatch password reset email / link |
| `POST` | `/api/auth/reset-password` | Verify token and update user password |
| `GET` | `/health` | Service health status |

---

## 🔒 Security & Best Practices

- **Zero Hardcoded Secrets**: All sensitive tokens and credentials are read strictly through environment variables.
- **Git Hygiene**: Runtime databases (`users.json`, `history.json`), caches, OS artifacts, and environment files (`.env*`) are excluded in `.gitignore`.
- **Statutory Privacy**: Form inputs are processed without third-party tracking; financial data is stored locally unless explicitly authenticated.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
