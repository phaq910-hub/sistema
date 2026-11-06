"""Generic admin CRUD router factory for simple collections."""

import uuid
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib.auth import require_admin
from lib.db import db
from lib.notify import now_iso


def crud_router(
    path: str,
    collection: str,
    create_model: type[BaseModel],
    model: type[BaseModel],
    sort: tuple[str, int] = ("name", 1),
    enrich: Callable | None = None,
) -> APIRouter:
    router = APIRouter()
    coll = db[collection]

    async def finish(doc: dict) -> dict:
        return await enrich(doc) if enrich else doc

    @router.get(f"/{path}", response_model=list[model], name=f"list_{collection}")
    async def list_items(_=Depends(require_admin)):
        docs = await coll.find({}, {"_id": 0}).sort(*sort).to_list(5000)
        return [model(**await finish(d)) for d in docs]

    @router.post(f"/{path}", response_model=model, name=f"create_{collection}")
    async def create_item(body: create_model, _=Depends(require_admin)):  # type: ignore[valid-type]
        doc = {**body.model_dump(), "id": str(uuid.uuid4()), "created_at": now_iso()}
        doc = await finish(doc)
        await coll.insert_one(dict(doc))
        return model(**doc)

    @router.put(f"/{path}/{{item_id}}", response_model=model, name=f"update_{collection}")
    async def update_item(item_id: str, body: create_model, _=Depends(require_admin)):  # type: ignore[valid-type]
        data = await finish(body.model_dump())
        res = await coll.find_one_and_update({"id": item_id}, {"$set": data}, projection={"_id": 0}, return_document=True)
        if not res:
            raise HTTPException(status_code=404, detail="Registro não encontrado")
        return model(**res)

    @router.delete(f"/{path}/{{item_id}}", name=f"delete_{collection}")
    async def delete_item(item_id: str, _=Depends(require_admin)):
        res = await coll.delete_one({"id": item_id})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Registro não encontrado")
        return {"ok": True}

    return router
