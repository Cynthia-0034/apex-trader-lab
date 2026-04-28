"""
Apex Engine — MT5 Bridge
========================
A minimal FastAPI service that exposes the MetaTrader 5 terminal to the
Lovable Cloud edge functions over HTTPS + bearer auth.

Run on a Windows VPS that has the MT5 terminal logged in to your broker.
See README.md in this folder for full setup instructions.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Literal, Optional

import MetaTrader5 as mt5  # type: ignore
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

# -------------------------------------------------------------------------
# Configuration (read from environment variables)
# -------------------------------------------------------------------------
BRIDGE_TOKEN = os.environ["MT5_BRIDGE_TOKEN"]      # required
MT5_LOGIN    = int(os.environ["MT5_LOGIN"])         # broker account number
MT5_PASSWORD = os.environ["MT5_PASSWORD"]
MT5_SERVER   = os.environ["MT5_SERVER"]             # e.g. "ICMarketsSC-Demo"
MT5_PATH     = os.environ.get("MT5_PATH")           # optional terminal64.exe path

# -------------------------------------------------------------------------
# App + auth
# -------------------------------------------------------------------------
app = FastAPI(title="Apex MT5 Bridge", version="1.0.0")


def require_token(authorization: Optional[str] = Header(None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    if authorization.removeprefix("Bearer ").strip() != BRIDGE_TOKEN:
        raise HTTPException(403, "Invalid bearer token")


@app.on_event("startup")
def _connect() -> None:
    init_kwargs = {"login": MT5_LOGIN, "password": MT5_PASSWORD, "server": MT5_SERVER}
    if MT5_PATH:
        init_kwargs["path"] = MT5_PATH
    if not mt5.initialize(**init_kwargs):
        code, msg = mt5.last_error()
        raise RuntimeError(f"MT5 init failed [{code}]: {msg}")


@app.on_event("shutdown")
def _disconnect() -> None:
    mt5.shutdown()


# -------------------------------------------------------------------------
# Schemas
# -------------------------------------------------------------------------
class OrderReq(BaseModel):
    pair: str = Field(..., examples=["EURUSD"])
    side: Literal["LONG", "SHORT"]
    lot_size: float = Field(..., gt=0, le=100)
    sl_price: float = Field(..., gt=0)
    tp_price: float = Field(..., gt=0)
    comment: str = "apex"


class CloseReq(BaseModel):
    ticket: int


# -------------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"ok": True, "ts": datetime.utcnow().isoformat() + "Z",
            "terminal_connected": mt5.terminal_info() is not None}


@app.get("/account", dependencies=[Depends(require_token)])
def account() -> dict:
    info = mt5.account_info()
    if info is None:
        raise HTTPException(502, f"account_info failed: {mt5.last_error()}")
    d = info._asdict()
    return {
        "login": d["login"], "server": d["server"], "currency": d["currency"],
        "balance": d["balance"], "equity": d["equity"],
        "margin": d["margin"], "margin_free": d["margin_free"],
        "leverage": d["leverage"], "trade_allowed": d["trade_allowed"],
    }


@app.get("/symbol/{pair}", dependencies=[Depends(require_token)])
def symbol(pair: str) -> dict:
    if not mt5.symbol_select(pair, True):
        raise HTTPException(404, f"Symbol {pair} not visible")
    tick = mt5.symbol_info_tick(pair)
    info = mt5.symbol_info(pair)
    if tick is None or info is None:
        raise HTTPException(502, f"tick/info failed: {mt5.last_error()}")
    spread_pips = (tick.ask - tick.bid) / (info.point * 10)
    return {"pair": pair, "bid": tick.bid, "ask": tick.ask,
            "spread_pips": round(spread_pips, 2),
            "digits": info.digits, "point": info.point,
            "ts": datetime.utcfromtimestamp(tick.time).isoformat() + "Z"}


@app.post("/order", dependencies=[Depends(require_token)])
def place_order(req: OrderReq) -> dict:
    if not mt5.symbol_select(req.pair, True):
        raise HTTPException(404, f"Symbol {req.pair} not visible")
    tick = mt5.symbol_info_tick(req.pair)
    if tick is None:
        raise HTTPException(502, "No tick available")
    order_type = mt5.ORDER_TYPE_BUY if req.side == "LONG" else mt5.ORDER_TYPE_SELL
    price      = tick.ask if req.side == "LONG" else tick.bid
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": req.pair, "volume": req.lot_size,
        "type": order_type, "price": price,
        "sl": req.sl_price, "tp": req.tp_price,
        "deviation": 20, "magic": 770001,
        "comment": req.comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        rc = result.retcode if result else None
        raise HTTPException(502, f"order_send failed retcode={rc} err={mt5.last_error()}")
    return {"ticket": result.order, "filled_price": result.price,
            "volume": result.volume, "retcode": result.retcode,
            "ts": datetime.utcnow().isoformat() + "Z"}


@app.post("/close", dependencies=[Depends(require_token)])
def close_position(req: CloseReq) -> dict:
    positions = mt5.positions_get(ticket=req.ticket)
    if not positions:
        raise HTTPException(404, f"Position {req.ticket} not found")
    p = positions[0]
    tick = mt5.symbol_info_tick(p.symbol)
    if tick is None:
        raise HTTPException(502, "No tick available")
    close_type = mt5.ORDER_TYPE_SELL if p.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price      = tick.bid if p.type == mt5.POSITION_TYPE_BUY else tick.ask
    request = {
        "action": mt5.TRADE_ACTION_DEAL, "position": p.ticket,
        "symbol": p.symbol, "volume": p.volume,
        "type": close_type, "price": price,
        "deviation": 20, "magic": 770001,
        "comment": "apex-close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
        rc = result.retcode if result else None
        raise HTTPException(502, f"close failed retcode={rc} err={mt5.last_error()}")
    return {"ticket": p.ticket, "exit_price": result.price,
            "pnl": p.profit, "ts": datetime.utcnow().isoformat() + "Z"}


@app.get("/positions", dependencies=[Depends(require_token)])
def positions() -> dict:
    pos = mt5.positions_get() or []
    return {"positions": [{
        "ticket": p.ticket, "pair": p.symbol,
        "side": "LONG" if p.type == mt5.POSITION_TYPE_BUY else "SHORT",
        "volume": p.volume, "entry_price": p.price_open,
        "sl": p.sl, "tp": p.tp, "pnl": p.profit, "swap": p.swap,
        "open_time": datetime.utcfromtimestamp(p.time).isoformat() + "Z",
        "comment": p.comment,
    } for p in pos]}


@app.post("/flatten", dependencies=[Depends(require_token)])
def flatten_all() -> dict:
    """Emergency: close every open position."""
    pos = mt5.positions_get() or []
    closed, errors = [], []
    for p in pos:
        try:
            tick = mt5.symbol_info_tick(p.symbol)
            close_type = mt5.ORDER_TYPE_SELL if p.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
            price = tick.bid if p.type == mt5.POSITION_TYPE_BUY else tick.ask
            r = mt5.order_send({
                "action": mt5.TRADE_ACTION_DEAL, "position": p.ticket,
                "symbol": p.symbol, "volume": p.volume,
                "type": close_type, "price": price, "deviation": 50,
                "magic": 770001, "comment": "apex-flatten",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            })
            if r and r.retcode == mt5.TRADE_RETCODE_DONE:
                closed.append(p.ticket)
            else:
                errors.append({"ticket": p.ticket, "retcode": getattr(r, "retcode", None)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"ticket": p.ticket, "error": str(exc)})
    return {"closed": closed, "errors": errors}
