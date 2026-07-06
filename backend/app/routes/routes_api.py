from fastapi import APIRouter
from ..sim.state import get_sim
from ..schemas.schemas import MetricsOut

router = APIRouter(prefix="/api", tags=["Routing & Metrics"])


@router.get("/routes")
def get_routes():
    sim = get_sim()
    sources = [n.uid for n in sim.nodes.values()
               if n.role != "Sink" and not n.isolated][:14]
    return [r for r in (sim.discover_route(s) for s in sources) if r]


@router.post("/routes/reconfigure")
def reconfigure(body: dict):
    sim = get_sim()
    src = body.get("src_uid")
    return sim.discover_route(src) if src else {"error": "src_uid required"}


@router.get("/metrics", response_model=MetricsOut)
def get_metrics():
    return get_sim().metrics()
