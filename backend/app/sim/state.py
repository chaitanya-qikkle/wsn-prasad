"""Process-wide singleton live runner shared across routes and the WS endpoint."""
import random

from .live_runner import LiveSimRunner
from .network import WSNSimulator

_runner: LiveSimRunner | None = None


def get_runner() -> LiveSimRunner:
    global _runner
    if _runner is None:
        _runner = LiveSimRunner(n_nodes=24, n_malicious=4, seed=random.randint(0, 2**31))
    return _runner


def reset_runner(n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None) -> LiveSimRunner:
    runner = get_runner()
    runner.reset(n_nodes=n_nodes, n_malicious=n_malicious, seed=seed)
    return runner


def get_sim() -> WSNSimulator:
    """Back-compat shim so existing REST route files can keep calling get_sim()."""
    return get_runner().sim


def reset_sim(n_nodes: int = 24, n_malicious: int = 4, seed: int | None = None) -> WSNSimulator:
    return reset_runner(n_nodes=n_nodes, n_malicious=n_malicious, seed=seed).sim
