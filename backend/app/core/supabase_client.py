"""Thin Supabase client wrapper.

The frontend talks to Supabase directly; the backend uses the service key for
privileged writes (recording detections, sealing blocks, updating node trust).
If credentials are absent the client is None and routes fall back to the
in-memory simulator so the API still runs for demos.
"""
from functools import lru_cache
from .config import get_settings

try:
    from supabase import create_client, Client
except Exception:  # pragma: no cover - supabase optional at import time
    create_client = None
    Client = None

@lru_cache
def get_supabase():
    settings = get_settings()
    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
    if not (create_client and settings.SUPABASE_URL and key):
        return None
    try:
        return create_client(settings.SUPABASE_URL, key)
    except Exception:
        return None
