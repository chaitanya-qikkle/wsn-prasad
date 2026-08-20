from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..sim.state import get_runner, reset_runner

router = APIRouter()

ACTIONS = {
    'inject': lambda r, args: r.inject(*args),
    'isolate': lambda r, args: r.isolate(*args),
    'restore': lambda r, args: r.restore(*args),
    'recoverAll': lambda r, args: r.recover_all(),
    'reset': lambda r, args: reset_runner(
        n_nodes=(args[0] or {}).get('nodes', 24) if args else 24,
        n_malicious=(args[0] or {}).get('malicious', 0) if args else 0,
    ),
    'play': lambda r, args: r.play(),
    'pause': lambda r, args: r.pause(),
    'step': lambda r, args: r.step_once(),
    'setSpeed': lambda r, args: r.set_speed(*args),
    'setAutoAttack': lambda r, args: r.set_auto_attack(*args),
    'setBaselineMode': lambda r, args: r.set_baseline_mode(*args),
    'clearPhases': lambda r, args: r.clear_phases(),
    'markRead': lambda r, args: r.mark_read(*args),
    'markAllRead': lambda r, args: r.mark_all_read(),
    'dismiss': lambda r, args: r.dismiss(*args),
}


@router.websocket("/ws/sim")
async def ws_sim(websocket: WebSocket):
    await websocket.accept()
    runner = get_runner()
    runner.clients.add(websocket)
    runner.start_task()
    await websocket.send_json({"type": "snapshot", "payload": runner.snapshot()})

    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") != "action":
                await websocket.send_json({"type": "error", "message": "unknown message type"})
                continue
            action = msg.get("action")
            handler = ACTIONS.get(action)
            if not handler:
                await websocket.send_json({"type": "error", "message": f"unknown action: {action}"})
                continue
            try:
                handler(runner, msg.get("args") or [])
            except Exception as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
                continue
            await runner.broadcast()
    except WebSocketDisconnect:
        pass
    finally:
        runner.clients.discard(websocket)
