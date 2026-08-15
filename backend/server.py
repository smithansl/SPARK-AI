from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

import sepang_data as sd

# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="SPARK API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("spark")


# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Models ----------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "citizen"  # citizen | planner


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ReportInput(BaseModel):
    zone_id: str
    waste_type: str
    description: str
    severity: str = "medium"  # low | medium | high


class ChatInput(BaseModel):
    message: str
    session_id: str


class SimInput(BaseModel):
    population_growth: float = 20
    recycling_rate: float = 20
    new_housing: int = 500
    new_commercial: bool = False


# ---------- Auth routes ----------
@api_router.post("/auth/register")
async def register(body: RegisterInput):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    role = body.role if body.role in ("citizen", "planner") else "citizen"
    doc = {"name": body.name, "email": email, "password_hash": hash_password(body.password),
           "role": role, "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_access_token(uid, email, role)
    return {"token": token, "user": {"id": uid, "name": body.name, "email": email, "role": role}}


@api_router.post("/auth/login")
async def login(body: LoginInput):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    token = create_access_token(uid, email, user["role"])
    return {"token": token, "user": {"id": uid, "name": user["name"], "email": email, "role": user["role"]}}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Spatial data routes ----------
@api_router.get("/kpis")
async def kpis():
    return sd.district_kpis()


@api_router.get("/zones")
async def zones():
    return sd.ZONES


@api_router.get("/zones/{zone_id}")
async def zone_detail(zone_id: str):
    z = next((z for z in sd.ZONES if z["id"] == zone_id), None)
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    return z


@api_router.get("/facilities")
async def facilities():
    return sd.FACILITIES


@api_router.get("/correlation")
async def correlation():
    return sd.compute_landuse_correlation()


@api_router.get("/forecast")
async def forecast():
    return sd.FORECAST


@api_router.get("/sites")
async def sites():
    return sd.CANDIDATE_SITES


@api_router.get("/routes")
async def routes():
    enriched = []
    for r in sd.ROUTES:
        stops = [next(z for z in sd.ZONES if z["id"] == sid) for sid in r["stops"]]
        enriched.append({**r, "stop_coords": [{"name": s["name"], "lat": s["lat"], "lng": s["lng"]} for s in stops]})
    return enriched


@api_router.post("/simulate")
async def simulate(body: SimInput):
    result = sd.simulate(body.population_growth, body.recycling_rate, body.new_housing, body.new_commercial)
    # AI narrative recommendation
    prompt = (
        f"A planner ran a what-if scenario for Sepang, Selangor.\n"
        f"Inputs: population growth +{body.population_growth}%, recycling rate {body.recycling_rate}%, "
        f"new housing {body.new_housing} units, new commercial area: {'yes' if body.new_commercial else 'no'}.\n"
        f"Computed impacts: waste +{result['waste_increase_pct']}%, collection demand +{result['collection_demand_pct']}%, "
        f"facility capacity gap {result['capacity_gap_hubs']} hub(s), traffic +{result['traffic_impact_pct']}%, "
        f"most affected: {result['affected_zone']}.\n"
        f"Write ONE short planning recommendation (max 3 sentences) as a professional urban planner. "
        f"Be specific and action-oriented (facility, catchment, priority)."
    )
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id="sim-" + secrets.token_hex(4),
                       system_message="You are SPARK, an AI spatial planning copilot for Sepang district (PBT).").with_model("anthropic", "claude-sonnet-4-6")
        ai_text = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                ai_text += ev.content
            elif isinstance(ev, StreamDone):
                break
        result["recommendation"] = ai_text.strip()
    except Exception as e:
        logger.error(f"sim AI error: {e}")
        result["recommendation"] = (
            f"Establish 1 additional community recovery hub within a 2 km service catchment of "
            f"{result['affected_zone']}. Priority: HIGH given the projected +{result['waste_increase_pct']}% waste load."
        )
    return result


# ---------- Citizen reports ----------
@api_router.post("/reports")
async def create_report(body: ReportInput, user: dict = Depends(get_current_user)):
    doc = {"zone_id": body.zone_id, "waste_type": body.waste_type, "description": body.description,
           "severity": body.severity, "reporter": user["name"], "reporter_id": user["id"],
           "created_at": datetime.now(timezone.utc).isoformat(), "status": "pending"}
    res = await db.reports.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api_router.get("/reports")
async def list_reports(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "planner" else {"reporter_id": user["id"]}
    docs = await db.reports.find(query).sort("created_at", -1).to_list(200)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs


# ---------- AI Copilot (streaming) ----------
SYSTEM_PROMPT = (
    "You are SPARK — Spatial Planning AI for Resource & Knowledge — an AI copilot for urban planners (PBT) "
    "in Sepang district, Selangor, Malaysia. You turn waste & community data into evidence-based spatial planning advice. "
    "ALWAYS structure your answer in four clearly-labelled markdown sections using this exact order and headings:\n"
    "**EVIDENCE** — the data/spatial facts.\n"
    "**ANALYSIS** — the spatial pattern or relationship (mention land-use/waste correlations).\n"
    "**PROJECTION** — what will happen by 2030/2035.\n"
    "**RECOMMENDATION** — a concrete planning action with priority and location.\n"
    "Be concise, professional and specific to Sepang zones (Labu Lanjut, KLIA/Sepang, Salak Tinggi, Dengkil, "
    "Sungai Pelek, Bagan Lalang, Kota Warisan, Sepang Town). Use figures where useful.\n"
    "District context: total waste ~42.8 t/month, avg recovery 73%, 6 critical/high hotspots, projected +18-24% waste by 2030."
)


@api_router.post("/ai/chat")
async def ai_chat(body: ChatInput, user: dict = Depends(get_current_user)):
    await db.chat_messages.insert_one({
        "session_id": body.session_id, "role": "user", "content": body.message,
        "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})

    async def event_generator():
        collected = ""
        try:
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=body.session_id,
                           system_message=SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-4-6")
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    collected += ev.content
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"chat AI error: {e}")
            yield "\n\n**RECOMMENDATION** — The AI engine is temporarily unavailable. Please retry."
        finally:
            await db.chat_messages.insert_one({
                "session_id": body.session_id, "role": "assistant", "content": collected,
                "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})

    return StreamingResponse(event_generator(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.get("/ai/history/{session_id}")
async def chat_history(session_id: str, user: dict = Depends(get_current_user)):
    docs = await db.chat_messages.find({"session_id": session_id, "user_id": user["id"]}).sort("created_at", 1).to_list(500)
    return [{"role": d["role"], "content": d["content"]} for d in docs]


@api_router.get("/")
async def root():
    return {"message": "SPARK API online"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "planner@spark.gov.my").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Sepang2030")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"name": "Chief Planner", "email": admin_email,
                                   "password_hash": hash_password(admin_password), "role": "planner",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Seeded planner admin")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    # seed a demo citizen
    citizen_email = "citizen@spark.my"
    if await db.users.find_one({"email": citizen_email}) is None:
        await db.users.insert_one({"name": "Aisha Citizen", "email": citizen_email,
                                   "password_hash": hash_password("citizen123"), "role": "citizen",
                                   "created_at": datetime.now(timezone.utc).isoformat()})


@app.on_event("shutdown")
async def shutdown():
    client.close()
