"""Criterion: back-office CRUD pages save and reflect in lists — products (+/- stock),
suppliers, catalog item, finance entry + toggle paid, company save (PIX key)."""

import uuid

import pytest


def test_products_stock_adjust(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/products", json={"name": f"tscheck-produto-{suffix}", "sku": suffix, "quantity": 5, "price": 10.0})
    assert r.status_code == 200, r.text
    product = r.json()
    assert product["quantity"] == 5

    r = admin_client.post(f"/products/{product['id']}/adjust", json={"delta": 3})
    assert r.status_code == 200, r.text
    assert r.json()["quantity"] == 8

    r = admin_client.post(f"/products/{product['id']}/adjust", json={"delta": -2})
    assert r.status_code == 200, r.text
    assert r.json()["quantity"] == 6

    r = admin_client.get("/products")
    assert r.status_code == 200
    assert any(p["id"] == product["id"] and p["quantity"] == 6 for p in r.json())


def test_suppliers_crud_and_product_link(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/suppliers", json={"name": f"tscheck-fornecedor-{suffix}", "category": "Peças"})
    assert r.status_code == 200, r.text
    supplier = r.json()

    r = admin_client.get("/suppliers")
    assert r.status_code == 200
    assert any(s["id"] == supplier["id"] for s in r.json())

    r = admin_client.post("/products", json={"name": f"tscheck-produto-sup-{suffix}", "supplier_id": supplier["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["supplier_name"] == supplier["name"]


def test_catalog_item_available_for_quotes(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/catalog", json={"name": f"tscheck-catalogo-{suffix}", "kind": "servico", "price": 99.9})
    assert r.status_code == 200, r.text
    item = r.json()

    r = admin_client.get("/catalog")
    assert r.status_code == 200
    assert any(c["id"] == item["id"] and c["price"] == 99.9 for c in r.json())


def test_finance_entry_create_and_toggle_paid(admin_client):
    suffix = uuid.uuid4().hex[:8]
    r = admin_client.post("/finance", json={
        "kind": "pagar", "description": f"tscheck-financeiro-{suffix}", "amount": 55.5, "due_date": "2099-01-01",
    })
    assert r.status_code == 200, r.text
    entry = r.json()
    assert entry["paid"] is False

    r = admin_client.post(f"/finance/{entry['id']}/toggle-paid")
    assert r.status_code == 200, r.text
    assert r.json()["paid"] is True
    assert r.json()["paid_at"]

    r = admin_client.post(f"/finance/{entry['id']}/toggle-paid")
    assert r.status_code == 200
    assert r.json()["paid"] is False


def test_company_save_and_pix_visible_publicly(admin_client):
    r = admin_client.get("/company")
    assert r.status_code == 200, r.text
    original = r.json()
    marker = uuid.uuid4().hex[:8]
    updated = {**original, "pix_key": f"tscheck-pix-{marker}@example.com", "pix_key_type": "email", "pix_holder": "Tscheck Holder"}

    try:
        r = admin_client.put("/company", json=updated)
        assert r.status_code == 200, r.text
        assert r.json()["pix_key"] == f"tscheck-pix-{marker}@example.com"

        r = admin_client.get("/public/company")
        assert r.status_code == 200
        assert r.json()["pix_key"] == f"tscheck-pix-{marker}@example.com"
    finally:
        # restore original company settings (this is a shared singleton, not a per-row fixture)
        admin_client.put("/company", json=original)
