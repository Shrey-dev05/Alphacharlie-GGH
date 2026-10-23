import io
import socket
import qrcode
from fastapi import APIRouter, Response

router = APIRouter(prefix="/system", tags=["system"])


def get_lan_ip() -> str:
    """Dynamically detects the machine's active LAN IPv4 address connected to the network."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


@router.get("/network-info")
def network_info():
    ip = get_lan_ip()
    port = 3000
    url = f"http://{ip}:{port}"
    return {
        "ip": ip,
        "port": port,
        "url": url,
        "is_localhost": ip in ("127.0.0.1", "localhost"),
    }


@router.get("/qr-code.png")
def get_qr_code():
    ip = get_lan_ip()
    url = f"http://{ip}:3000"
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F1E36", back_color="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="image/png")
