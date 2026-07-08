from fastapi import APIRouter, HTTPException
from ..sim.state import get_sim, get_runner

router = APIRouter(prefix="/api/nodes", tags=["Nodes"])


@router.get("")
def list_nodes():
    return get_sim().topology()


@router.get("/topology")
def topology():
    sim = get_sim()
    return {"nodes": sim.topology(), "sink": "N-001"}


@router.post("/{uid}/isolate")
async def isolate(uid: str):
    runner = get_runner()
    n = runner.sim.nodes.get(uid)
    if not n:
        raise HTTPException(404, "node not found")
    runner.isolate(uid)
    await runner.broadcast()
    return {"node_uid": uid, "isolated": True, "trust": n.trust}


@router.post("/{uid}/restore")
async def restore(uid: str):
    runner = get_runner()
    n = runner.sim.nodes.get(uid)
    if not n:
        raise HTTPException(404, "node not found")
    runner.restore(uid)
    await runner.broadcast()
    return {"node_uid": uid, "isolated": False, "trust": n.trust}
