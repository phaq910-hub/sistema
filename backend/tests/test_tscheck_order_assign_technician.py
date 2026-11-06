"""Criterion: in Ordens de Serviço, assigning a technician to an approved OS sets status 'atribuida'."""

import uuid

import httpx
import pytest


@pytest.fixture
def approved_order(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/clients", json={"name": f"tscheck-assign-client-{suffix}", "phone": "11988887777"})
    assert r.status_code == 200, r.text
    client_id = r.json()["id"]

    r = admin_client.post("/quotes", json={
        "client_id": client_id, "client_name": "ignored",
        "items": [{"description": "Manutenção", "quantity": 1, "unit_price": 100.0}],
        "valid_until": "2099-12-31",
    })
    assert r.status_code == 200, r.text
    quote = r.json()

    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as pub:
        r = pub.post(f"/public/quotes/{quote['id']}/approve")
    assert r.status_code == 200, r.text
    return r.json()["order_id"]


def test_assign_technician_sets_status_atribuida(admin_client, approved_order):
    r = admin_client.get("/technicians")
    assert r.status_code == 200, r.text
    techs = r.json()
    carlos = next((t for t in techs if t["email"] == "tecnico@techline.com"), None)
    assert carlos, "seeded technician Carlos not found"

    r = admin_client.post(f"/orders/{approved_order}/assign", json={"technician_id": carlos["id"]})
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "atribuida"
    assert order["technician_id"] == carlos["id"]
    assert order["technician_name"] == carlos["name"]


def test_assign_invalid_technician_rejected(admin_client, approved_order):
    r = admin_client.post(f"/orders/{approved_order}/assign", json={"technician_id": "not-a-real-id"})
    assert r.status_code == 400, r.text
