from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "TrustChain-WSN API"
    VERSION:  str = "1.0.0"
    DEBUG:    bool = False

    SUPABASE_URL:         str = ""
    SUPABASE_ANON_KEY:    str = ""
    SUPABASE_SERVICE_KEY: str = ""

    SECRET_KEY: str = "change-me-in-production-trustchain-wsn-secret"
    ALGORITHM:  str = "HS256"

    # WSN / framework parameters
    TRUST_THRESHOLD:   float = 0.40      # isolate below this
    DROP_PENALTY:      float = 0.08      # trust drop per detected packet loss event
    DELAY_PENALTY:     float = 0.05
    BLOCK_DIFFICULTY:  int = 2           # leading-zero difficulty for PoW demo
    MAX_MALICIOUS_PCT: float = 0.25      # attack containment cap — never let more than this
                                          # share of the network be compromised at once

    # Automatic recovery. An isolated node is scrubbed after QUARANTINE_TICKS
    # rounds, then has to earn its way back above TRUST_THRESHOLD at
    # TRUST_REBUILD_RATE per round before it is readmitted to routing.
    AUTO_RECOVERY:      bool  = True     # off ⇒ isolation is permanent (baseline behaviour)
    QUARANTINE_TICKS:   int   = 3        # rounds of isolation before remediation completes
    TRUST_REBUILD_RATE: float = 0.08     # trust regained per round while on probation
    # Hysteresis. A node is isolated at TRUST_THRESHOLD but only readmitted
    # once it climbs this much higher, so a freshly recovered node does not sit
    # on the boundary and flap straight back into quarantine.
    READMIT_MARGIN:     float = 0.25

    CORS_ORIGINS: list[str] = [
        "http://localhost:5174",
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
    ]

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
