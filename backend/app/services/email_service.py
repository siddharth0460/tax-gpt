import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=True)

def send_password_reset_email(to_email: str, reset_url: str, user_name: str = "Taxpayer") -> dict:
    """
    Sends a password reset email via standard SMTP (e.g. Gmail, SendGrid, etc.).
    If SMTP credentials are not yet configured in backend/.env, it safely logs
    the generated reset link to the server console and returns simulated status.
    """
    # Reload environment to catch dynamically updated .env
    load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=True)
    
    smtp_host = (os.environ.get("SMTP_HOST") or "").strip()
    smtp_port_raw = (os.environ.get("SMTP_PORT") or "587").strip()
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        smtp_port = 587

    smtp_user = (os.environ.get("SMTP_USER") or "").strip()
    smtp_password = (os.environ.get("SMTP_PASSWORD") or "").strip()
    from_email = (os.environ.get("SMTP_FROM_EMAIL") or "").strip() or smtp_user or "noreply@taxcopilot.com"
    from_name = (os.environ.get("SMTP_FROM_NAME") or "TaxCopilot").strip().strip("\"'")

    subject = "TaxCopilot: Password Reset Instructions"
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0f19;
      color: #f3f4f6;
      margin: 0;
      padding: 30px 15px;
    }}
    .card {{
      max-width: 520px;
      margin: 0 auto;
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 36px 28px;
    }}
    .logo {{
      font-size: 20px;
      font-weight: 800;
      color: #3b82f6;
      margin-bottom: 20px;
      letter-spacing: -0.5px;
    }}
    h2 {{
      color: #ffffff;
      font-size: 20px;
      margin: 0 0 16px 0;
    }}
    p {{
      color: #9ca3af;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 18px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin: 12px 0 24px 0;
    }}
    .link-alt {{
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
      background: #1f2937;
      padding: 12px;
      border-radius: 6px;
    }}
    .footer {{
      font-size: 12px;
      color: #4b5563;
      margin-top: 32px;
      border-top: 1px solid #1f2937;
      padding-top: 16px;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🛡️ TaxCopilot</div>
    <h2>Password Reset Request</h2>
    <p>Hello {user_name},</p>
    <p>We received a request to reset the password for your TaxCopilot account (<strong>{to_email}</strong>). Click the button below to set a new password:</p>
    <div style="text-align: center;">
      <a href="{reset_url}" class="btn">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <div class="link-alt">{reset_url}</div>
    <p style="margin-top: 18px; font-size: 13px;">This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
    <div class="footer">TaxCopilot • Indian Income Tax Planner &amp; Strategy Engine</div>
  </div>
</body>
</html>"""

    text_content = f"""Hello {user_name},

We received a request to reset the password for your TaxCopilot account ({to_email}).

Please open the following link in your browser to set a new password:
{reset_url}

This link is valid for 1 hour. If you did not request this, you can ignore this email.

TaxCopilot Team
"""

    # If SMTP is not yet configured, log the reset URL to console
    if not smtp_host or not smtp_user or not smtp_password:
        print("\n" + "=" * 65)
        print(" [EMAIL SERVICE] SMTP is not yet configured in backend/.env")
        print(f" [EMAIL SERVICE] Target Recipient: {to_email}")
        print(f" [EMAIL SERVICE] Password Reset Link: {reset_url}")
        print(" [EMAIL SERVICE] Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env for real delivery.")
        print("=" * 65 + "\n")
        return {
            "sent": False,
            "simulated": True,
            "reset_url": reset_url,
            "message": "Reset link generated. (Configure SMTP in backend/.env for real email dispatch)",
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()

        print(f"[EMAIL SERVICE] Successfully sent password reset email to {to_email}")
        return {"sent": True, "simulated": False, "message": f"Password reset email sent to {to_email}"}

    except Exception as e:
        print(f"[EMAIL SERVICE ERROR] Failed to send email via SMTP: {e}")
        print(f"[EMAIL SERVICE] Fallback Reset Link: {reset_url}")
        return {
            "sent": False,
            "simulated": False,
            "error": str(e),
            "reset_url": reset_url,
            "message": f"Failed to send email via SMTP: {str(e)}",
        }
