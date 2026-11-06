import uuid

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import clear_session, current_user, hash_password, require_admin, set_session, verify_password
from lib.db import db
from models.schemas import LoginInput, TechnicianCreate, User

router = APIRouter()


@router.post("/auth/login", response_model=User)
async def login(body: LoginInput, response: Response):
    doc = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    set_session(response, doc["id"])
    return User(**doc)


@router.post("/auth/logout")
async def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@router.get("/auth/me", response_model=User)
async def me(user: User = Depends(current_user)):
    return user


@router.get("/technicians", response_model=list[User])
async def list_technicians(_: User = Depends(require_admin)):
    docs = await db.users.find({"role": "tech"}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(500)
    return [User(**d) for d in docs]


@router.post("/technicians", response_model=User)
async def create_technician(body: TechnicianCreate, _: User = Depends(require_admin)):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Já existe um usuário com este e-mail")
    user = User(id=str(uuid.uuid4()), name=body.name.strip(), email=email, role="tech", phone=body.phone)
    await db.users.insert_one({**user.model_dump(), "password_hash": hash_password(body.password)})
    return user
