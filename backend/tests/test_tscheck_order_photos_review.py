"""Criterion: technician starts OS, adds before/after photos, finishes with signature;
public tracking page's photos endpoint reflects them and the review appears in Avaliações."""

import uuid

import httpx
import pytest

TINY_PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
TINY_JPEG = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
)


@pytest.fixture
def assigned_order(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/clients", json={"name": f"tscheck-techflow-client-{suffix}", "phone": "11977776666", "address": "Av Teste 500"})
    assert r.status_code == 200, r.text
    client_id = r.json()["id"]

    r = admin_client.post("/quotes", json={
        "client_id": client_id, "client_name": "ignored",
        "items": [{"description": "Reparo", "quantity": 1, "unit_price": 180.0}],
        "valid_until": "2099-12-31",
    })
    assert r.status_code == 200, r.text
    quote = r.json()

    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as pub:
        r = pub.post(f"/public/quotes/{quote['id']}/approve")
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]

    r = admin_client.get("/technicians")
    carlos = next(t for t in r.json() if t["email"] == "tecnico@techline.com")
    r = admin_client.post(f"/orders/{order_id}/assign", json={"technician_id": carlos["id"]})
    assert r.status_code == 200, r.text
    return order_id


def test_technician_photo_finish_review_flow(admin_client, tech_client, assigned_order):
    order_id = assigned_order

    r = tech_client.post(f"/orders/{order_id}/start")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "em_deslocamento"

    r = tech_client.post(f"/orders/{order_id}/photos", json={"kind": "antes", "image": TINY_JPEG, "caption": "antes"})
    assert r.status_code == 200, r.text
    r = tech_client.post(f"/orders/{order_id}/photos", json={"kind": "depois", "image": TINY_JPEG, "caption": "depois"})
    assert r.status_code == 200, r.text

    # public tracking page sees the photos (no auth)
    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as pub:
        r = pub.get(f"/orders/{order_id}/photos")
        assert r.status_code == 200
        photos = r.json()
        assert len(photos) == 2
        assert {p["kind"] for p in photos} == {"antes", "depois"}

        # finish rejected before begin-activity (400)
        r = tech_client.post(f"/orders/{order_id}/finish", json={
            "notes": "tentativa precoce", "signer_name": "Cliente Teste", "signature": TINY_PNG,
        })
        assert r.status_code == 400, r.text

        r = tech_client.post(f"/orders/{order_id}/arrive")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "no_local"

        r = tech_client.post(f"/orders/{order_id}/begin")
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "em_atendimento"

        r = tech_client.post(f"/orders/{order_id}/finish", json={
            "notes": "Serviço concluído com sucesso", "signer_name": "Cliente Teste", "signature": TINY_PNG,
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "concluida"

        # public can submit a review once concluded
        r = pub.post(f"/public/orders/{order_id}/review", json={"rating": 5, "comment": "tscheck excelente atendimento"})
        assert r.status_code == 200, r.text
        review = r.json()
        assert review["rating"] == 5

    # review appears in Avaliações
    r = admin_client.get("/reviews")
    assert r.status_code == 200
    assert any(rv["id"] == review["id"] for rv in r.json())

    # duplicate review rejected
    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as pub:
        r = pub.post(f"/public/orders/{order_id}/review", json={"rating": 3, "comment": "dup"})
        assert r.status_code == 400
