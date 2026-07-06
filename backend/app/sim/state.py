"""Process-wide singleton simulator instance shared across routes."""
from .network import WSNSimulator

_sim: WSNSimulator | None = None


def get_sim() -> WSNSimulator:
    global _sim
    if _sim is None:
        _sim = WSNSimulator(n_nodes=24, n_malicious=4, seed=42)
    return _sim


def reset_sim(n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None) -> WSNSimulator:
    global _sim
    _sim = WSNSimulator(n_nodes=n_nodes, n_malicious=n_malicious, seed=seed)
    return _sim
