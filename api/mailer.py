"""Sending email (sign-in links for teachers and tutors, api/accounts.py).

SMTP settings come from the environment (Coolify → API app → Environment):

    SMTP_HOST       e.g. mail.privateemail.com (Namecheap Private Email)
    SMTP_PORT       465 (SSL, default) or 587 (STARTTLS)
    SMTP_USER       the mailbox, e.g. hello@krabsy.com
    SMTP_PASSWORD   its password (only in Coolify, never in the repo)
    MAIL_FROM       optional, default "Krabsy <SMTP_USER>"
    MAIL_FROM_DE    optional sender per interface language, e.g.
    MAIL_FROM_ES    "Krabsy <hallo@krabsy.com>" / "Krabsy <hola@krabsy.com>";
    MAIL_FROM_EN    falls back to MAIL_FROM. The SMTP mailbox must be allowed
                    to send as that address (an alias of the same mailbox).

Without SMTP_HOST (local preview, tests) nothing is sent: the mail is printed
to the server log and kept in OUTBOX, so the link can be used from there.
Sending runs in a background thread so a slow mail server never blocks a request.
"""
from __future__ import annotations

import os
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

OUTBOX: list[dict] = []          # mails "sent" without SMTP (tests, local preview)


def configured() -> bool:
    return bool(os.environ.get("SMTP_HOST", "").strip())


def sender(lang: str | None = None) -> str:
    """From: MAIL_FROM_<LANG> → MAIL_FROM → "Krabsy <SMTP_USER>"."""
    user = os.environ.get("SMTP_USER", "").strip()
    per_lang = os.environ.get(f"MAIL_FROM_{lang.upper()}", "").strip() if lang and lang.isalpha() else ""
    return per_lang or os.environ.get("MAIL_FROM", "").strip() or formataddr(("Krabsy", user))


def _send_now(to: str, subject: str, text: str, html: str | None, lang: str | None = None) -> None:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "465") or 465)
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    msg = EmailMessage()
    msg["From"] = sender(lang)
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=(user.split("@")[-1] or "krabsy.com"))
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=20) as s:
            s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.starttls(context=ctx)
            s.login(user, password)
            s.send_message(msg)


def send(to: str, subject: str, text: str, html: str | None = None, lang: str | None = None) -> None:
    if not configured():
        OUTBOX.append({"to": to, "subject": subject, "text": text, "lang": lang})
        del OUTBOX[:-50]
        print(f"[krabsy] mail (not sent, no SMTP_HOST) to {to}: {subject}\n{text}", flush=True)
        return

    def run() -> None:
        try:
            _send_now(to, subject, text, html, lang)
        except Exception as exc:  # noqa: BLE001
            print(f"[krabsy] mail to {to.split('@')[-1]} failed: {exc}", flush=True)
    threading.Thread(target=run, name="mail", daemon=True).start()
