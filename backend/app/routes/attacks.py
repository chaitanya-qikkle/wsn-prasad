from fastapi import APIRouter
from ..sim.state import get_sim

router = APIRouter(prefix="/api/attacks", tags=["Attacks"])


@router.get("")
def list_detections(limit: int = 100):
    sim = get_sim()
    return sim.detections[-limit:][::-1]


@router.get("/trust")
def trust_table():
    sim = get_sim()
    return sorted(
        [{"node_uid": n.uid, "trust": n.trust, "isolated": n.isolated,
          "malicious": n.malicious} for n in sim.nodes.values()],
        key=lambda x: x["trust"],
    )
