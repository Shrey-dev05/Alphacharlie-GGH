# Pramaan Portal — Manual Setup & Mobile Access Guide

This guide provides step-by-step instructions to manually run the **FastAPI Backend** and **Next.js Frontend** using your IDE terminal (VS Code, PowerShell, or Command Prompt), and how to open and use the portal on your **mobile phone** over your local Wi-Fi.

---

## 1. Network & Port Architecture

| Component | Port | Host Binding | Local URL (Laptop) | Mobile LAN URL |
|---|---|---|---|---|
| **Next.js Frontend** | `3000` | `0.0.0.0` | [http://localhost:3000](http://localhost:3000) | `http://<YOUR_IP>:3000` |
| **FastAPI Backend** | `8000` | `0.0.0.0` | [http://localhost:8000](http://localhost:8000) | `http://<YOUR_IP>:8000` |
| **Swagger API Docs** | `8000` | `0.0.0.0` | [http://localhost:8000/docs](http://localhost:8000/docs) | `http://<YOUR_IP>:8000/docs` |

> **Note**: Binding to `0.0.0.0` (instead of `127.0.0.1`) allows other devices on the same Wi-Fi network (such as your phone) to connect to your laptop.

---

## 2. Step 1: Run the Backend (FastAPI)

Open your first terminal in your IDE (VS Code / PowerShell / Command Prompt).

### Option A: Using the Automated Batch Script (Recommended)
```cmd
cd backend
run_backend.bat
```

### Option B: Manual Commands in PowerShell / VS Code Terminal
1. Navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
2. Activate the Python virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
   *(If script execution is disabled in PowerShell, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*
3. Add Tesseract OCR to your session PATH:
   ```powershell
   $env:PATH = "C:\Program Files\Tesseract-OCR;C:\Users\shrey\.tools\tesseract;" + $env:PATH
   ```
4. Start the Uvicorn server:
   ```powershell
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Option C: Manual Commands in Command Prompt (CMD)
```cmd
cd backend
call .venv\Scripts\activate.bat
set "PATH=C:\Program Files\Tesseract-OCR;C:\Users\shrey\.tools\tesseract;%PATH%"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verification: You should see:
```text
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser to verify API endpoints.

---

## 3. Step 2: Run the Frontend (Next.js)

Open a **second terminal** in your IDE (keep the backend terminal running).

### Option A: Using the Automated Batch Script (Recommended)
```cmd
cd frontend
run_npm.bat run dev
```

### Option B: Manual Commands in PowerShell / VS Code Terminal
1. Navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
2. Ensure Node.js is in your session PATH:
   ```powershell
   $env:PATH = "C:\Users\shrey\.tools\nodejs;" + $env:PATH
   ```
3. Start the Next.js development server bound to `0.0.0.0`:
   ```powershell
   npm run dev
   ```
   *(Or run directly: `npx next dev -H 0.0.0.0 -p 3000`)*

### Option C: Manual Commands in Command Prompt (CMD)
```cmd
cd frontend
set "PATH=C:\Users\shrey\.tools\nodejs;%PATH%"
npm run dev
```

Verification: You should see:
```text
▲ Next.js 14.2.35
- Local:        http://localhost:3000
- Network:      http://0.0.0.0:3000
✓ Ready in 1.5s
```
Open [http://localhost:3000](http://localhost:3000) in your laptop browser to see the Pramaan Portal.

---

## 4. Step 3: Open on Mobile Phone (Port & Network Setup)

You can run the full inspection portal and take live photos of packaging with your phone's camera.

### 1. Find Your Laptop's Current Local Wi-Fi IP
In any terminal, run this PowerShell command:
```powershell
(Get-NetIPAddress -InterfaceAlias "Wi-Fi*" -AddressFamily IPv4).IPAddress
```
*(Alternatively, run `ipconfig` and look for the **IPv4 Address** under `Wireless LAN adapter Wi-Fi`, e.g., `10.137.212.98` or `192.168.1.50`)*

### 2. Connect Your Phone
1. Ensure your mobile phone is connected to the **exact same Wi-Fi network** as your laptop.
2. Open **Chrome** or **Safari** on your phone.
3. Enter your laptop's IP address with port `3000`:
   ```text
   http://<YOUR_LAPTOP_IP>:3000
   ```
   *Example:*
   ```text
   http://10.137.212.98:3000
   ```

### 3. Or Scan the QR Code Directly
1. On your laptop, open [http://localhost:3000](http://localhost:3000).
2. In the top navigation bar, click the **"Use on Phone"** button.
3. A modal opens with a dynamic, automatically generated QR code and your current IP.
4. Scan the QR code with your phone camera app to open the website instantly.

---

## 5. Troubleshooting Mobile Connection (Windows Firewall)

If the website loads on your laptop (`http://localhost:3000`) but shows **"This site can't be reached"** or times out on your phone, Windows Firewall is blocking inbound connections from your Wi-Fi.

### Solution 1: Switch Network to Private (Quickest, 10 seconds)
By default, Windows sets new Wi-Fi networks to **Public**, which silently drops all incoming traffic from other local devices.
1. Press `Win + I` to open **Windows Settings**.
2. Go to **Network & internet** -> **Wi-Fi**.
3. Click on your currently connected Wi-Fi network.
4. Under **Network profile type**, change the selection from **Public network** to **Private network**.
5. Refresh the website on your phone. It will connect immediately.

### Solution 2: Explicitly Allow Ports 3000 & 8000 in Windows Firewall
Open **PowerShell as Administrator** and run:
```powershell
netsh advfirewall firewall add rule name="Pramaan Frontend (Port 3000)" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Pramaan Backend (Port 8000)" dir=in action=allow protocol=TCP localport=8000
```

---

## 6. Using the Mobile Packaging Camera Scanner

1. Once the portal opens on your phone, navigate to **Scan Label** (`/upload`).
2. Tap the **Camera Scan** button.
3. Your mobile browser will prompt for camera access:
   - **Live Optical Stream**: If prompted, tap **Allow** to center the label inside the crosshairs and capture.
   - **Device Camera Fallback**: If browser camera permissions are blocked on plain HTTP, tap **"Use Device Camera App"** to launch your phone's native camera directly and snap a high-resolution photo.
4. The packaging image is uploaded to the backend analysis pipeline and inspected in real-time.

---

## 7. Inspector Override & Compliance Control

When defects are detected during label inspection:
- **Individual Defect Override**: Click **"Ignore Defect (Mark Compliant)"** on any violation card to enter an official clearance justification (e.g. *"Physically verified on packaging"* or *"Exempt under Rule 26"*).
- **1-Click Bulk Approval**: Click **"Approve Product (Ignore All Defects)"** in the top action bar to immediately clear all remaining issues and certify the product as **COMPLIANT (100%)**.
- **Official PDF Report**: Click **"Download Gazetted PDF Report"** to generate a tamper-evident, checksum-verified statutory certificate reflecting the final compliant verdict.

---

## 8. Default Login Credentials

If logged out, use any of the pre-configured inspector accounts:

| Role | Email / Username | Default Password |
|---|---|---|
| **Field Inspector** | `inspector_test@gov.in` | `Inspector@123` |
| **Field Inspector** | `test@gmail.com` | `testpassword123` |
| **Self Registration** | Navigate to `/register` to create a custom inspector or auditor account. |
