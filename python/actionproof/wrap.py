"""Auto-receipt helpers for Python agents: a decorator + a LangChain/CrewAI callback.

The decorator wraps any function so it emits a signed receipt on each call. The
callback handler plugs into LangChain/CrewAI's tool lifecycle so every tool a
framework agent runs is attested — with no per-tool code.
"""
from __future__ import annotations

import functools
from typing import Any, Callable, Optional

from .core import attest
from .keys import AgentKeypair


def attest_action(
    kp: AgentKeypair,
    *,
    type: str,
    target: Optional[str] = None,
    summary: Optional[Callable[..., str]] = None,
    delegation: Optional[dict] = None,
    agent_name: Optional[str] = None,
    on_receipt: Callable[[dict], None],
    on_error: str = "failed",
):
    """Decorator: emit a receipt for every call. Transparent to the wrapped fn.

        @attest_action(kp, type="email.send", on_receipt=store)
        def send_email(to, body): ...
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            call_params = {"args": list(args), "kwargs": kwargs}
            try:
                result = fn(*args, **kwargs)
                on_receipt(
                    attest(
                        kp,
                        type=type,
                        target=target,
                        summary=summary(*args, **kwargs) if summary else None,
                        params=call_params,
                        result=result,
                        outcome="ok",
                        delegation=delegation,
                        agent_name=agent_name,
                    )
                )
                return result
            except Exception as err:  # noqa: BLE001 — emit failed receipt, re-raise
                on_receipt(
                    attest(
                        kp,
                        type=type,
                        target=target,
                        summary=f"error: {err}",
                        params=call_params,
                        outcome=on_error,  # type: ignore[arg-type]
                        delegation=delegation,
                        agent_name=agent_name,
                    )
                )
                raise

        return wrapper

    return decorator


class ActionProofCallbackHandler:
    """LangChain-compatible callback that attests every tool run.

    Import and pass in callbacks=[ActionProofCallbackHandler(kp, on_receipt=...)].
    Subclasses LangChain's BaseCallbackHandler when available; otherwise works as
    a plain object so the package has no hard LangChain dependency.
    """

    def __init__(self, kp: AgentKeypair, on_receipt: Callable[[dict], None]):
        self._kp = kp
        self._on_receipt = on_receipt
        self._pending: dict[str, str] = {}  # run_id -> tool name

    def on_tool_start(self, serialized: dict, input_str: str, **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", ""))
        self._pending[run_id] = (serialized or {}).get("name", "tool.call")

    def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", ""))
        name = self._pending.pop(run_id, "tool.call")
        self._on_receipt(
            attest(self._kp, type=name, result={"output": str(output)}, outcome="ok")
        )

    def on_tool_error(self, error: BaseException, **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", ""))
        name = self._pending.pop(run_id, "tool.call")
        self._on_receipt(
            attest(self._kp, type=name, summary=f"error: {error}", outcome="failed")
        )


# If LangChain is installed, make the handler a real BaseCallbackHandler so it
# registers correctly with the framework's callback machinery.
try:  # pragma: no cover - depends on optional install
    from langchain_core.callbacks import BaseCallbackHandler as _Base

    class ActionProofCallbackHandler(_Base, ActionProofCallbackHandler):  # type: ignore[no-redef]
        pass
except Exception:  # noqa: BLE001
    pass
