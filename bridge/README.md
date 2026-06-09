# Apex MT5 Bridge

A tiny FastAPI sidecar that runs **next to your MT5 terminal** on a Windows VPS (or local machine with MT5 installed) and exposes a read‑only HTTP surface that Apex Engine can call from its Lovable Cloud edge functions.

Apex never connects to your broker directly — it talks **only** to this bridge.

---

## Endpoints

All endpoints require `Authorization: Bearer <MT5_BRIDGE_TOKEN>`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok: true, version, ts }` — liveness ping |
| GET | `/account` | `{ ok, balance, equity, currency, login }` — real account snapshot |
| GET | `/quote?symbol=EURUSD` | `{ ok, bid, ask, time }` — current tick |
| GET | `/candles?symbol=EURUSD&timeframe=H1&count=500` | `{ ok, candles: [{ts, open, high, low, close, volume, spread}] }` |

**No POST endpoints.** This bridge is intentionally read‑only. Order placement is a future, separate, JWT‑gated bridge.

---

## Setup

```bash
pip install -r requirements.txt
# Set environment
set MT5_LOGIN=12345678
set MT5_PASSWORD=your_password
set MT5_SERVER=FXPesa-Demo        # or FXPesa-Live
set BRIDGE_TOKEN=$(openssl rand -hex 32)
# Run
uvicorn main:app --host 0.0.0.0 --port 8787
```

Expose it over HTTPS (Caddy / Cloudflare Tunnel / ngrok are all fine). Then add two secrets to Lovable Cloud:

- `MT5_BRIDGE_URL` → `https://your-bridge.example.com`
- `MT5_BRIDGE_TOKEN` → same value as `BRIDGE_TOKEN` above

Verify with the **Test bridge** button on the Apex dashboard.

---

## FXPesa symbol mapping

FXPesa exposes EUR/USD as the symbol `EURUSD` (no suffix). If your broker uses a suffix
(`EURUSDm`, `EURUSD.r`, etc.), set `SYMBOL_SUFFIX` in the env, e.g. `SYMBOL_SUFFIX=m`.

The bridge transparently appends the suffix before calling MT5 and strips it on the way back.

---

## Safety notes

- The bridge **only reads**. It cannot place, modify, or close orders.
- Run it on the same host as MT5 — the MetaTrader5 Python library is Windows‑only.
- Use a strong `BRIDGE_TOKEN` and put the service behind HTTPS and/or an IP allow‑list.
- The Apex `mt5-bridge-probe` edge function logs every probe to the `events` table.
