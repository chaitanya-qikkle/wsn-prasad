from fastapi import APIRouter, HTTPException
from ..sim.state import get_sim, reset_sim
from ..schemas.schemas import SimRequest, AttackInject, DashboardOut, MetricsOut

router = APIRouter(prefix="/api/sim", tags=["Simulation"])


@router.post("/start")
def start(req: SimRequest):
    sim = reset_sim(req.n_nodes, req.n_malicious, req.seed)
    all_detections = []
    for _ in range(max(1, req.rounds)):
        all_detections.extend(sim.evaluate_trust())
    return {
        "nodes": sim.topology(),
        "detections": all_detections,
        "metrics": sim.metrics(),
        "block_height": sim.chain.head.index,
    }


@router.post("/step")
def step():
    """Run one trust-evaluation round (event-driven block if anything fires)."""
    sim = get_sim()
    detections = sim.evaluate_trust()
    return {"detections": detections, "metrics": sim.metrics(),
            "block_height": sim.chain.head.index, "chain_valid": sim.chain.is_valid()}


@router.post("/attack")
def inject(body: AttackInject):
    sim = get_sim()
    n = sim.nodes.get(body.node_uid)
    if not n:
        raise HTTPException(404, "node not found")
    n.malicious = True
    n.attack = body.attack_type
    return {"node_uid": n.uid, "attack": n.attack, "malicious": True}


@router.get("/dashboard", response_model=DashboardOut)
def dashboard():
    sim = get_sim()
    nodes = list(sim.nodes.values())
    return DashboardOut(
        total_nodes=len(nodes),
        isolated_nodes=sum(1 for n in nodes if n.isolated),
        malicious_nodes=sum(1 for n in nodes if n.malicious),
        detections=len(sim.detections),
        block_height=sim.chain.head.index,
        chain_valid=sim.chain.is_valid(),
        metrics=MetricsOut(**sim.metrics()),
    )
