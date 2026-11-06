"""Idempotent seed: admin + one technician. Run: cd /app/backend && python seed.py"""

import asyncio
import uuid

from lib.auth import hash_password
from lib.db import db, ensure_indexes

USERS = [
    {"name": "Administrador Techline", "email": "admin@techline.com", "password": "admin123", "role": "admin", "phone": ""},
    {"name": "Carlos Técnico", "email": "tecnico@techline.com", "password": "tecnico123", "role": "tech", "phone": ""},
]


async def main() -> None:
    await ensure_indexes()
    for u in USERS:
        existing = await db.users.find_one({"email": u["email"]})
        data = {k: v for k, v in u.items() if k != "password"}
        data["password_hash"] = hash_password(u["password"])
        if existing:
            await db.users.update_one({"email": u["email"]}, {"$set": data})
        else:
            await db.users.insert_one({"id": str(uuid.uuid4()), **data})
    print("seed ok")


if __name__ == "__main__":
    asyncio.run(main())
