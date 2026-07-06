from pydantic import BaseModel
from typing import Optional, List


class NodeOut(BaseModel):
    node_uid: str
    label: Optional[str] = None
    role: str
    pos_x: float
    pos_y: float
    energy: float
    trust_score: float
    is_malicious: bool
    is_isolated: bool
    status: str
    packets_fwd: int
    packets_drop: int
    avg_delay: float


class DetectionOut(BaseModel):
    node_uid: str
    attack_type: str
    severity: str
    confidence: float
    trust_before: float
    trust_after: float
    drop_ratio: float
    delay_anomaly: float
    identity_flag: bool
    status: str
    mitigation: str
    block_index: Optional[int] = None


class RouteOut(BaseModel):
    src_uid: str
    dst_uid: str
    hops: List[str]
    hop_count: int
    path_trust: float
    latency: float
    is_active: bool
    reconfigured: bool
    reason: Optional[str] = None


class MetricsOut(BaseModel):
    pdr: float
    avg_delay: float
    throughput: float
    energy_avg: float
    alive_nodes: int
    malicious_active: int
    overhead: float


class SimRequest(BaseModel):
    n_nodes: int = 24
    n_malicious: int = 4
    rounds: int = 1
    seed: Optional[int] = None


class AttackInject(BaseModel):
    node_uid: str
    attack_type: str = "Blackhole"


class DashboardOut(BaseModel):
    total_nodes: int
    isolated_nodes: int
    malicious_nodes: int
    detections: int
    block_height: int
    chain_valid: bool
    metrics: MetricsOut
