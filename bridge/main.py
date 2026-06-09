"""
Apex MT5 Bridge — read-only FastAPI sidecar for the MT5 terminal.

Run on a Windows host (or Windows VPS) that has the MetaTrader 5 terminal installed
and is logged in to your FXPesa account. Never exposes order endpoints.

Environment:
    MT5_LOGIN, MT5_PASSWORD, MT5_SERVER   — broker credentials
    BRIDGE_TOKEN                          — shared secret for Authorization: Bearer
    SYMBOL_SUFFIX                         — optional broker symbol suffix (e.g. "m")
    MT5_PATH                              — optional path to terminal64.exe
"""
import os
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

try:
    import MetaTrader5 as mt5  # type: ignore
except ImportError:  # pragma: no cover
    mt5 = None  # allows the file to be imported in CI for type-checking

VERSION = "1.0.0"

LOGIN = int(os.environ.get("MT5_LOGIN", "0"))
PASSWORD = os.environ.get("MT5_PASSWORD", "")
SERVER = os.environ.get("MT5_SERVER", "")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
SYMBOL_SUFFIX = os.environ.get("SYMBOL_SUFFIX", "")
MT5_PATH = os.environ.get("MT5_PATH")

TIMEFRAME_MAP = {
    "M1":  1,   "M5":  5,   "M15": 15,
    "M30": 30,  "H1": 16385, "H4": 16388, "D1": 16408,
} if mt5 is None else {
    "M1":  mt5.TIMEFRAME_M1,  "M5":  mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15, "M30": mt5.TIMEFRAME_M30,
    "H1":  mt5.TIMEFRAME_H1,  "H4":  mt5.TIMEFRAME_H4,
    "D1":  mt5.TIMEFRAME_D1,
}

app = FastAPI(title="Apex MT5 Bridge", version=VERSION)


def _check_auth(authorization: Optional[str]) -> None:
    if not BRIDGE_TOKEN:
        raise HTTPException(500, "BRIDGE_TOKEN not configured on bridge")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    if authorization.split(" ", 1)[1].strip() != BRIDGE_TOKEN:
        raise HTTPException(403, "Bad bearer token")


def _ensure_init() -> None:
    if mt5 is None:
        raise HTTPException(500, "MetaTrader5 library not installed")
    if not mt5.initialize(path=MT5_PATH, login=LOGIN, password=PASSWORD, server=SERVER):
        err = mt5.last_error()
        raise HTTPException(503, f"MT5 init failed: {err}")


def _symbol(s: str) -> str:
    return f"{s}{SYMBOL_SUFFIX}" if SYMBOL_SUFFIX else s


@app.get("/health")
def health(authorization: Optional[str] = Header(default=None)):
    _check_auth(authorization)
    _ensure_init()
    info = mt5.terminal_info()
    return {
        "ok": True, "version": VERSION,
        "ts": datetime.now(timezone.utc).isoformat(),
        "terminal_connected": bool(info and info.connected),
    }


@app.get("/account")
def account(authorization: Optional[str] = Header(default=None)):
    _check_auth(authorization)
    _ensure_init()
    a = mt5.account_info()
    if a is None:
        raise HTTPException(503, f"account_info failed: {mt5.last_error()}")
    return {
        "ok": True, "login": a.login, "balance": a.balance, "equity": a.equity,
        "margin": a.margin, "free_margin": a.margin_free, "currency": a.currency,
        "leverage": a.leverage, "server": SERVER,
    }


class QuoteOut(BaseModel):
    ok: bool
    symbol: str
    bid: float
    ask: float
    time: str


@app.get("/quote", response_model=QuoteOut)
def quote(symbol: str = Query(...), authorization: Optional[str] = Header(default=None)):
    _check_auth(authorization)
    _ensure_init()
    sym = _symbol(symbol)
    if not mt5.symbol_select(sym, True):
        raise HTTPException(404, f"symbol not found: {sym}")
    tick = mt5.symbol_info_tick(sym)
    if tick is None:
        raise HTTPException(503, f"no tick for {sym}")
    return QuoteOut(
        ok=True, symbol=symbol, bid=tick.bid, ask=tick.ask,
        time=datetime.fromtimestamp(tick.time, tz=timezone.utc).isoformat(),
    )


@app.get("/candles")
def candles(
    symbol: str = Query(...),
    timeframe: str = Query("H1"),
    count: int = Query(500, ge=1, le=5000),
    authorization: Optional[str] = Header(default=None),
):
    _check_auth(authorization)
    _ensure_init()
    if timeframe not in TIMEFRAME_MAP:
        raise HTTPException(400, f"unsupported timeframe {timeframe}")
    sym = _symbol(symbol)
    if not mt5.symbol_select(sym, True):
        raise HTTPException(404, f"symbol not found: {sym}")
    rates = mt5.copy_rates_from(sym, TIMEFRAME_MAP[timeframe], datetime.now(timezone.utc), count)
    if rates is None:
        raise HTTPException(503, f"copy_rates failed: {mt5.last_error()}")
    out = [{
        "ts": datetime.fromtimestamp(int(r["time"]), tz=timezone.utc).isoformat(),
        "open": float(r["open"]), "high": float(r["high"]),
        "low": float(r["low"]), "close": float(r["close"]),
        "volume": float(r["tick_volume"]), "spread": float(r["spread"]) / 10.0,
    } for r in rates]
    return {"ok": True, "symbol": symbol, "timeframe": timeframe, "count": len(out), "candles": out}
