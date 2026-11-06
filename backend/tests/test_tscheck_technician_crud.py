"""Criterion: Técnicos tab creates technician access that can log in, be edited, and deleted."""

import uuid

import httpx
import pytest


def test_create_edit_delete_technician(admin_client):
    suffix = uuid.uuid4().hex[:8]
    email = f"tscheck-tech-{suffix}@techline.com"
    r = admin_client.post("/technicians", json={
        "name": "Tscheck Tecnico", "email": email, "password": "senha1234", "phone": "11911112222",
    })
    assert r.status_code == 200, r.text
    tech = r.json()
    assert tech["role"] == "tech"

    # new technician can log in
    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": email, "password": "senha1234"})
        assert r.status_code == 200, r.text
        r = c.get("/auth/me")
        assert r.status_code == 200
        assert r.json()["id"] == tech["id"]
        assert r.json()["role"] == "tech"

    # duplicate email rejected
    r = admin_client.post("/technicians", json={
        "name": "Dup", "email": email, "password": "outrasenha", "phone": "",
    })
    assert r.status_code == 400

    # edit name
    r = admin_client.put(f"/users/{tech['id']}", json={"name": "Tscheck Tecnico Editado", "phone": "11933334444", "password": ""})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Tscheck Tecnico Editado"

    # delete (the row this test created — never a seeded account)
    r = admin_client.delete(f"/users/{tech['id']}")
    assert r.status_code == 200, r.text

    # now login fails
    with httpx.Client(base_url=admin_client.base_url, timeout=30.0) as c:
        r = c.post("/auth/login", json={"email": email, "password": "senha1234"})
        assert r.status_code == 401
