import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, ensure_indexes
from lib import whatsapp
from routers import auth, backoffice, notifications, orders, push, quotes, tickets


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    wa_proc = await whatsapp.spawn()
    yield
    if wa_proc and wa_proc.returncode is None:
        wa_proc.terminate()
        with suppress(Exception):
            await asyncio.wait_for(wa_proc.wait(), 5)
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Techline Consultoria API"}


api_router.include_router(auth.router)
api_router.include_router(quotes.router)
api_router.include_router(orders.router)
api_router.include_router(notifications.router)
api_router.include_router(tickets.router)
api_router.include_router(backoffice.router)
api_router.include_router(push.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Include the router in the main app — keep last
app.include_router(api_router)
