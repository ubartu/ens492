# app/db/deps.py
import os
from fastapi_ai_scheduler.app.db.fakeSession_DB import FakeSession

USE_FAKE_DB = os.getenv("USE_FAKE_DB", "0") == "1"
_fake_session_singleton = FakeSession() if USE_FAKE_DB else None

def get_fake_session():
    """
    Dependency yielding a FakeSession-like object.
    """
    yield _fake_session_singleton or FakeSession()
