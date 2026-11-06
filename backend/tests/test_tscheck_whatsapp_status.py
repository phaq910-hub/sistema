"""Criterion: WhatsApp tab QR login — status endpoint reports connection state used by the UI
to render the QR / connected badge. Real device connection is out of scope here (no phone linked)."""


def test_whatsapp_status_endpoint_shape(admin_client):
    r = admin_client.get("/whatsapp/status")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] in {"offline", "disconnected", "connecting", "qr", "connected"}


def test_whatsapp_send_without_connection_fails_gracefully(admin_client):
    # No phone is linked in this environment — sending must surface a clear error, not a 500.
    r = admin_client.post("/whatsapp/send", json={"phone": "11999999999", "text": "tscheck mensagem de teste"})
    assert r.status_code in (400, 503), r.text
