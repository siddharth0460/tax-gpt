from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Tax Copilot API",
    description="Backend API for the AI Tax Copilot SaaS Platform",
    version="0.1.0",
)

# Set up CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import tax_saver, auth

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AI Tax Copilot Backend is running"}


app.include_router(tax_saver.router)
app.include_router(auth.router)
