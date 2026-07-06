from fastapi import APIRouter
from ..sim.state import get_sim

router = APIRouter(prefix="/api/ledger", tags=["Blockchain"])


@router.get("")
def get_ledger():
    return get_sim().chain.to_list()[::-1]


@router.get("/verify")
def verify_chain():
    sim = get_sim()
    return {"valid": sim.chain.is_valid(), "height": sim.chain.head.index,
            "blocks": len(sim.chain.chain)}
