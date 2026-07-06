from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .routes import nodes, attacks, ledger, routes_api, sim

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Event-Driven Lightweight Blockchain-Based Secure Routing for Industrial WSNs — REST API",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nodes.router)
app.include_router(attacks.router)
app.include_router(ledger.router)
app.include_router(routes_api.router)
app.include_router(sim.router)


@app.get("/", tags=["Health"])
def root():
    return {"app": settings.APP_NAME, "version": settings.VERSION, "status": "operational"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy", "version": settings.VERSION}
