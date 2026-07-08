from fastapi import APIRouter, HTTPException
from ..sim.state import get_runner, reset_runner
from ..schemas.schemas import SimRequest, AttackInject, DashboardOut, MetricsOut, SnapshotOut

router = APIRouter(prefix="/api/sim", tags=["Simulation"])


@router.post("/start")
async def start(req: SimRequest):
    runner = reset_runner(req.n_nodes, req.n_malicious, req.seed)
    all_detections = []
    for _ in range(max(1, req.rounds)):
        all_detections.extend(runner.step())
    await runner.broadcast()
    return {
        "nodes": runner.sim.topology(),
        "detections": all_detections,
        "metrics": runner.sim.metrics(),
        "block_height": runner.sim.chain.head.index,
    }


@router.post("/step")
async def step():
    """Run one trust-evaluation round (event-driven block if anything fires)."""
    runner = get_runner()
    detections = runner.step()
    await runner.broadcast()
    return {"detections": detections, "metrics": runner.sim.metrics(),
            "block_height": runner.sim.chain.head.index, "chain_valid": runner.sim.chain.is_valid()}


@router.post("/attack")
async def inject(body: AttackInject):
    runner = get_runner()
    n = runner.sim.nodes.get(body.node_uid)
    if not n:
        raise HTTPException(404, "node not found")
    runner.inject(body.node_uid, body.attack_type)
    await runner.broadcast()
    return {"node_uid": n.uid, "attack": n.attack, "malicious": True, "trust": n.trust}


@router.get("/snapshot", response_model=SnapshotOut)
def snapshot():
    return get_runner().snapshot()


@router.get("/dashboard", response_model=DashboardOut)
def dashboard():
    runner = get_runner()
    sim = runner.sim
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
