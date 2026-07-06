from fastapi import APIRouter, HTTPException
from ..sim.state import get_sim

router = APIRouter(prefix="/api/nodes", tags=["Nodes"])


@router.get("")
def list_nodes():
    return get_sim().topology()


@router.get("/topology")
def topology():
    sim = get_sim()
    return {"nodes": sim.topology(), "sink": "N-001"}


@router.post("/{uid}/isolate")
def isolate(uid: str):
    sim = get_sim()
    n = sim.nodes.get(uid)
    if not n:
        raise HTTPException(404, "node not found")
    n.isolated = True
    n.trust = 0.1
    return {"node_uid": uid, "isolated": True, "trust": n.trust}


@router.post("/{uid}/restore")
def restore(uid: str):
    sim = get_sim()
    n = sim.nodes.get(uid)
    if not n:
        raise HTTPException(404, "node not found")
    n.isolated = False
    n.trust = 0.8
    return {"node_uid": uid, "isolated": False, "trust": n.trust}
