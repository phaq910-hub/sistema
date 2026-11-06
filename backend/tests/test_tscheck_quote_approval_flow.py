"""Criterion: client -> chamado -> orçamento (linked) -> public approval creates OS,
chamado becomes 'aprovado', and a 'A receber' financeiro entry appears for the amount."""

import uuid

import pytest


@pytest.fixture
def client_id(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/clients", json={
        "name": f"tscheck-quoteflow-client-{suffix}", "phone": "11999990000", "address": "Rua Teste, 123",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_quote_approval_creates_order_and_finance(admin_client, client_id):
    # create ticket (chamado) for this client
    r = admin_client.post("/tickets", json={"client_id": client_id, "title": "tscheck chamado", "description": "teste"})
    assert r.status_code == 200, r.text
    ticket = r.json()
    assert ticket["status"] == "aberto"

    # create quote linked to the ticket
    r = admin_client.post("/quotes", json={
        "client_id": client_id, "client_name": "ignored", "ticket_id": ticket["id"],
        "items": [{"description": "Serviço X", "quantity": 1, "unit_price": 250.0}],
        "valid_until": "2099-12-31",
    })
    assert r.status_code == 200, r.text
    quote = r.json()
    assert quote["total"] == 250.0
    assert quote["status"] == "pendente"

    # ticket now shows orcamento status
    r = admin_client.get("/tickets")
    assert r.status_code == 200
    t = next(x for x in r.json() if x["id"] == ticket["id"])
    assert t["status"] == "orcamento"
    assert t["quote_id"] == quote["id"]

    # client approves via public link (no auth)
    import httpx
    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as pub:
        r = pub.post(f"/public/quotes/{quote['id']}/approve")
    assert r.status_code == 200, r.text
    approved = r.json()
    assert approved["status"] == "aprovado"
    assert approved["order_id"]

    # chamado reflects aprovado
    r = admin_client.get("/tickets")
    t = next(x for x in r.json() if x["id"] == ticket["id"])
    assert t["status"] == "aprovado"

    # OS exists, aguardando técnico (aberta, no tech assigned on this quote)
    r = admin_client.get("/orders")
    assert r.status_code == 200
    order = next(o for o in r.json() if o["id"] == approved["order_id"])
    assert order["status"] == "aberta"
    assert order["technician_id"] is None

    # finance shows a 'A receber' (kind=receber) entry for the quote amount, current month, unpaid
    r = admin_client.get("/finance")
    assert r.status_code == 200
    entries = [e for e in r.json() if e.get("quote_id") == quote["id"]]
    assert len(entries) == 1, f"expected exactly one finance entry for quote, got {entries}"
    entry = entries[0]
    assert entry["kind"] == "receber"
    assert entry["amount"] == 250.0
    assert entry["paid"] is False
