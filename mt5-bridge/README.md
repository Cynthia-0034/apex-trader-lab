# Apex Engine — MT5 Bridge

A tiny FastAPI service that lets Lovable Cloud edge functions place real orders on your MT5 broker account.

```
[Lovable Cloud edge fn] --HTTPS+bearer--> [this bridge on Windows VPS] --native--> [MT5 terminal] --> [broker]
```

You only need to do this **once**. After that the bridge runs as a Windows service and the rest happens from the Lovable app.

---

## 1. What you need

- A **Windows VPS** with at least 2 vCPU / 2 GB RAM. Tested providers: Contabo, Vultr, AWS EC2 (Windows), Hetzner.
- A **funded MT5 account** at your broker. **Use a small live account** for the first weeks ($100–$500 max).
- A **domain name or static IP** for the VPS so Lovable can reach it over HTTPS.
- About 45 minutes.

> ⚠️ The MT5 terminal must stay logged in 24/7 for trading to work. That's why a VPS is required — your laptop sleeping = no trades.

---

## 2. Install MT5 on the VPS

1. RDP into the VPS.
2. Download MT5 from your broker's website (NOT generic MetaQuotes — broker-branded).
3. Install, launch, log in with your broker credentials. Confirm you can see the EURUSD chart and your account balance.
4. In MT5 → **Tools → Options → Expert Advisors**, tick **"Allow algorithmic trading"**.

Leave MT5 running. Do not log out.

---

## 3. Install Python + the bridge

In a Windows PowerShell on the VPS:

```powershell
# Install Python 3.11 (skip if already installed)
winget install -e --id Python.Python.3.11

# Verify
python --version          # should print Python 3.11.x

# Create a folder for the bridge
mkdir C:\apex-bridge
cd C:\apex-bridge
```

Copy the three files from this `mt5-bridge/` folder onto the VPS into `C:\apex-bridge\`:

- `server.py`
- `requirements.txt`
- `.env.example` → rename to `.env` and fill in real values

```powershell
# Create a virtualenv and install deps
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Generate the bearer token

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy that string into `.env` as `MT5_BRIDGE_TOKEN`. **You will paste this same value into Lovable later** — keep it safe.

---

## 4. First run (HTTP, local only)

```powershell
# Load .env into the current shell
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }

# Start the bridge on localhost
uvicorn server:app --host 127.0.0.1 --port 8088
```

In another PowerShell window on the VPS:

```powershell
curl http://127.0.0.1:8088/health
# {"ok":true,...,"terminal_connected":true}

curl -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:8088/account
# Should print your real broker balance, equity, etc.
```

If `/account` returns your balance, the MT5 connection works. Stop the server (`Ctrl+C`).

---

## 5. Expose it over HTTPS

The bridge **must not** be reachable over plain HTTP from the internet (your token would leak).
The simplest setup uses **Caddy**, which auto-issues a Let's Encrypt cert.

```powershell
# Install Caddy
winget install -e --id CaddyServer.Caddy
```

Create `C:\apex-bridge\Caddyfile`:

```
mt5.yourdomain.com {
    reverse_proxy 127.0.0.1:8088
}
```

Point your domain's A record at the VPS public IP. Open ports **80** and **443** in the Windows Firewall.

```powershell
# Run Caddy (it will get a TLS cert automatically)
caddy run --config C:\apex-bridge\Caddyfile
```

From your laptop:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://mt5.yourdomain.com/account
```

If you see your balance, you're done with the network layer.

> **No domain?** You can use Cloudflare Tunnel or Tailscale Funnel instead — both give you HTTPS without owning a domain. Or use the VPS's IP with a self-signed cert (Lovable edge fns reject self-signed; not recommended).

---

## 6. Run the bridge as a Windows service

You don't want the bridge to die when you close the RDP window. Use **NSSM**:

```powershell
winget install -e --id NSSM.NSSM
```

Create `C:\apex-bridge\start.bat`:

```bat
@echo off
cd /d C:\apex-bridge
call venv\Scripts\activate.bat
for /f "tokens=1,* delims==" %%a in (.env) do set %%a=%%b
uvicorn server:app --host 127.0.0.1 --port 8088
```

Install as a service:

```powershell
nssm install ApexBridge "C:\apex-bridge\start.bat"
nssm set     ApexBridge AppStdout "C:\apex-bridge\bridge.log"
nssm set     ApexBridge AppStderr "C:\apex-bridge\bridge.log"
nssm start   ApexBridge

# Same for Caddy:
nssm install ApexCaddy "C:\Program Files\Caddy\caddy.exe" run --config C:\apex-bridge\Caddyfile
nssm start   ApexCaddy
```

Both services now auto-start on reboot. Verify once more from your laptop:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://mt5.yourdomain.com/account
```

---

## 7. Hand the URL + token to Lovable

Come back to the Apex Engine app and open the **Go Live** panel (Safety page).
You'll be asked for two secrets:

- `MT5_BRIDGE_URL` → e.g. `https://mt5.yourdomain.com`
- `MT5_BRIDGE_TOKEN` → the token you generated in step 4

Once those are saved, click **Test connection**. The app should fetch your live balance.

---

## 8. Endpoints (reference)

| Method | Path                  | Purpose                                          |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/health`             | Public liveness probe (no auth)                  |
| GET    | `/account`            | Account balance / equity / margin                |
| GET    | `/symbol/{pair}`      | Bid / ask / spread for a symbol                  |
| POST   | `/order`              | Market order with mandatory SL+TP                |
| POST   | `/close`              | Close one position by ticket                     |
| GET    | `/positions`          | List all open positions                          |
| POST   | `/flatten`            | Emergency: close every open position             |

All endpoints except `/health` require `Authorization: Bearer <MT5_BRIDGE_TOKEN>`.

---

## 9. Safety notes

- The bridge only accepts orders **with both SL and TP** — Pydantic enforces it.
- Magic number `770001` tags every order placed by Apex; trades you place manually in MT5 are ignored by reconciliation.
- The `/flatten` endpoint exists for emergencies. The Apex UI exposes it as a big red button.
- Rotate `MT5_BRIDGE_TOKEN` every 90 days. Update both the `.env` on the VPS **and** the Lovable secret.
- Keep the VPS firewall closed to everything except 80/443 (and 3389 from your IP only for RDP).
