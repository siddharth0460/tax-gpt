import os
import json
import hashlib
import secrets
import time
from pathlib import Path
from typing import Optional, Dict, Any
import httpx
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "users.json"

def _ensure_user_store() -> Dict[str, Any]:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        initial_data = {
            "users": {},
            "tokens": {},
            "reset_tokens": {}
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(initial_data, f, indent=2)
        return initial_data

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "users" not in data:
                data["users"] = {}
            if "tokens" not in data:
                data["tokens"] = {}
            if "reset_tokens" not in data:
                data["reset_tokens"] = {}
            return data
    except Exception:
        return {"users": {}, "tokens": {}, "reset_tokens": {}}

def _save_user_store(data: Dict[str, Any]):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def _hash_password(password: str, salt: str) -> str:
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return key.hex()

# Request and Response schemas
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class GoogleAuthRequest(BaseModel):
    access_token: Optional[str] = None
    credential: Optional[str] = None

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    avatar: str

class AuthResponse(BaseModel):
    user: UserProfile
    token: str
    message: str

@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    name = req.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters long")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    store = _ensure_user_store()
    if email in store["users"]:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    salt = secrets.token_hex(16)
    pwd_hash = _hash_password(req.password, salt)
    user_id = f"usr_{secrets.token_hex(6)}"
    avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={name.replace(' ', '')}"

    new_user = {
        "id": user_id,
        "email": email,
        "name": name,
        "salt": salt,
        "password_hash": pwd_hash,
        "avatar": avatar,
        "created_at": int(time.time()),
    }
    token = f"tok_{secrets.token_urlsafe(32)}"

    store["users"][email] = new_user
    store["tokens"][token] = {
        "email": email,
        "created_at": int(time.time()),
    }
    _save_user_store(store)

    return AuthResponse(
        user=UserProfile(id=user_id, name=name, email=email, avatar=avatar),
        token=token,
        message="Registration successful"
    )

@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    email = req.email.strip().lower()
    store = _ensure_user_store()
    user_record = store["users"].get(email)

    if not user_record:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    expected_hash = _hash_password(req.password, user_record["salt"])
    if not secrets.compare_digest(expected_hash, user_record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = f"tok_{secrets.token_urlsafe(32)}"
    store["tokens"][token] = {
        "email": email,
        "created_at": int(time.time()),
    }
    _save_user_store(store)

    return AuthResponse(
        user=UserProfile(
            id=user_record["id"],
            name=user_record["name"],
            email=user_record["email"],
            avatar=user_record.get("avatar", f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_record['name']}")
        ),
        token=token,
        message="Login successful"
    )

@router.post("/google", response_model=AuthResponse)
def google_auth(req: GoogleAuthRequest):
    if not req.access_token and not req.credential:
        raise HTTPException(status_code=400, detail="access_token or credential is required")

    profile_data = None

    try:
        with httpx.Client(timeout=10.0) as client:
            if req.access_token:
                resp = client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {req.access_token}"}
                )
                if resp.status_code == 200:
                    profile_data = resp.json()
            elif req.credential:
                resp = client.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
                )
                if resp.status_code == 200:
                    profile_data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google authentication service error: {str(e)}")

    if not profile_data:
        raise HTTPException(status_code=401, detail="Invalid or expired Google authentication credentials")

    email = profile_data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Unable to retrieve verified email from Google account")

    name = profile_data.get("name", "").strip() or profile_data.get("given_name", "").strip() or "Google User"
    avatar = profile_data.get("picture", "") or f"https://api.dicebear.com/7.x/avataaars/svg?seed={name.replace(' ', '')}"

    store = _ensure_user_store()

    if email in store["users"]:
        user_record = store["users"][email]
        user_record["name"] = name
        user_record["avatar"] = avatar
        user_id = user_record["id"]
    else:
        salt = secrets.token_hex(16)
        user_id = f"usr_{secrets.token_hex(6)}"
        new_user = {
            "id": user_id,
            "email": email,
            "name": name,
            "salt": salt,
            "password_hash": "",
            "avatar": avatar,
            "auth_provider": "google",
            "created_at": int(time.time()),
        }
        store["users"][email] = new_user

    token = f"tok_{secrets.token_urlsafe(32)}"
    store["tokens"][token] = {
        "email": email,
        "created_at": int(time.time()),
    }
    _save_user_store(store)

    return AuthResponse(
        user=UserProfile(id=user_id, name=name, email=email, avatar=avatar),
        token=token,
        message="Google sign-in successful"
    )

@router.get("/me", response_model=UserProfile)
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ")[1]
    store = _ensure_user_store()
    token_data = store.get("tokens", {}).get(token)

    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    email = token_data.get("email")
    user_record = store.get("users", {}).get(email)
    if not user_record:
        raise HTTPException(status_code=404, detail="User account not found")

    return UserProfile(
        id=user_record["id"],
        name=user_record["name"],
        email=user_record["email"],
        avatar=user_record.get("avatar", f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_record['name']}")
    )

class UpdateProfileRequest(BaseModel):
    name: str
    avatar: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.put("/profile", response_model=UserProfile)
def update_profile(req: UpdateProfileRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    new_name = req.name.strip()
    if len(new_name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters long")

    store = _ensure_user_store()
    user_record = store["users"].get(user.email)
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")

    user_record["name"] = new_name
    if req.avatar:
        user_record["avatar"] = req.avatar
    _save_user_store(store)

    return UserProfile(
        id=user_record["id"],
        name=user_record["name"],
        email=user_record["email"],
        avatar=user_record["avatar"]
    )

@router.put("/password")
def change_password(req: ChangePasswordRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")

    store = _ensure_user_store()
    user_record = store["users"].get(user.email)
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")

    if user_record.get("password_hash"):
        expected = _hash_password(req.current_password, user_record["salt"])
        if not secrets.compare_digest(expected, user_record["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_salt = secrets.token_hex(16)
    user_record["salt"] = new_salt
    user_record["password_hash"] = _hash_password(req.new_password, new_salt)
    _save_user_store(store)

    return {"status": "ok", "message": "Password updated successfully"}

from ...services.email_service import send_password_reset_email

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    store = _ensure_user_store()
    user_record = store.get("users", {}).get(email)

    if not user_record:
        return {
            "status": "ok",
            "message": f"If an account exists for {email}, password reset instructions have been sent."
        }

    # Generate a cryptographically secure 1-hour reset token
    token = f"rst_{secrets.token_urlsafe(32)}"
    expires_at = int(time.time()) + 3600  # 1 hour
    store.setdefault("reset_tokens", {})[token] = {
        "email": email,
        "expires_at": expires_at
    }
    _save_user_store(store)

    app_url = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
    reset_url = f"{app_url}/auth?mode=reset&token={token}"

    email_res = send_password_reset_email(
        to_email=email,
        reset_url=reset_url,
        user_name=user_record.get("name", "Taxpayer")
    )

    resp_data = {
        "status": "ok",
        "message": f"Password reset instructions have been sent to {email}.",
    }
    # In development / simulated mode, return the reset_url so the user can test immediately
    if email_res.get("simulated") or email_res.get("reset_url"):
        resp_data["reset_url"] = reset_url
        resp_data["dev_note"] = "SMTP not configured: Reset link generated and logged to console."

    return resp_data

@router.get("/verify-reset-token")
def verify_reset_token(token: str):
    store = _ensure_user_store()
    token_entry = store.get("reset_tokens", {}).get(token)
    if not token_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    if time.time() > token_entry.get("expires_at", 0):
        del store["reset_tokens"][token]
        _save_user_store(store)
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    return {"status": "ok", "email": token_entry.get("email")}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    token = req.token.strip()
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    store = _ensure_user_store()
    token_entry = store.get("reset_tokens", {}).get(token)
    if not token_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")

    if time.time() > token_entry.get("expires_at", 0):
        del store["reset_tokens"][token]
        _save_user_store(store)
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    email = token_entry.get("email")
    user_record = store.get("users", {}).get(email)
    if not user_record:
        raise HTTPException(status_code=404, detail="User account not found.")

    new_salt = secrets.token_hex(16)
    user_record["salt"] = new_salt
    user_record["password_hash"] = _hash_password(req.new_password, new_salt)
    if user_record.get("auth_provider") == "google":
        user_record["auth_provider"] = "both"

    # Remove used token
    del store["reset_tokens"][token]
    _save_user_store(store)

    return {"status": "ok", "message": "Password updated successfully. You can now sign in with your new password."}

