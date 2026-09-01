from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import json
import math
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

import sepang_data as sd
import layer_analysis

# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

# ---------- Object storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "spark"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

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
    layer_ids: Optional[List[str]] = None


class SimInput(BaseModel):
    population_growth: float = 20
    recycling_rate: float = 20
    new_housing: int = 500
    new_commercial: bool = False


class DropoffItem(BaseModel):
    id: str
    item: str
    weight: float


class DropoffInput(BaseModel):
    items: List[DropoffItem]
    center_id: Optional[str] = None


class ConvertInput(BaseModel):
    points: int
    mode: str = "cash"  # cash | reward


class ComplaintInput(BaseModel):
    category: str
    description: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    photo_path: Optional[str] = None


class AssistantInput(BaseModel):
    message: str
    session_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class GeoLayerCreate(BaseModel):
    name: str
    style: dict
    geojson: dict
    description: Optional[str] = None


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
    "District context: total waste ~42.8 t/month, avg recovery 73%, 6 critical/high hotspots, projected +18-24% waste by 2030.\n"
    "You also have access to the planner's ACTIVE MAP LAYER DATA (waste choropleth + land-use). When the user asks "
    "about the layers on the map (e.g. which land use dominates critical waste zones), use the CROSS-ANALYSIS figures "
    "provided in the layer data block and cite the exact percentages."
)


@api_router.post("/ai/chat")
async def ai_chat(body: ChatInput, user: dict = Depends(get_current_user)):
    await db.chat_messages.insert_one({
        "session_id": body.session_id, "role": "user", "content": body.message,
        "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})

    try:
        layer_ctx = layer_analysis.layer_context_text(body.layer_ids)
    except Exception as e:
        logger.error(f"layer context error: {e}")
        layer_ctx = ""
    full_message = f"{layer_ctx}\n\nPlanner question: {body.message}" if layer_ctx else body.message

    async def event_generator():
        collected = ""
        try:
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=body.session_id,
                           system_message=SYSTEM_PROMPT).with_model("anthropic", "claude-sonnet-4-6")
            async for ev in chat.stream_message(UserMessage(text=full_message)):
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


# ---------- Citizen: recycling reference data ----------
@api_router.get("/recycling/rates")
async def recycling_rates():
    return sd.RECYCLING_RATES


@api_router.get("/recycling/centers")
async def recycling_centers():
    return sd.BUY_BACK_CENTERS


@api_router.get("/recycling/schedule")
async def recycling_schedule():
    return sd.COLLECTION_SCHEDULE


@api_router.get("/announcements")
async def announcements():
    return sd.ANNOUNCEMENTS


# ---------- Citizen: wallet ----------
async def _get_or_create_wallet(user: dict):
    w = await db.wallets.find_one({"user_id": user["id"]})
    if w is None:
        now = datetime.now(timezone.utc).isoformat()
        w = {"user_id": user["id"], "balance": 24.60, "points": 1240, "total_kg": 86.5,
             "dropoffs": 7, "created_at": now}
        await db.wallets.insert_one(w)
        seed_txns = [
            {"user_id": user["id"], "type": "dropoff", "description": "PET Plastic · 3.2kg · BBC Salak Tinggi", "amount": 2.24, "points": 224, "kg": 3.2, "created_at": now},
            {"user_id": user["id"], "type": "dropoff", "description": "Aluminium Cans · 1.1kg · DTRC Kota Warisan", "amount": 4.95, "points": 495, "kg": 1.1, "created_at": now},
            {"user_id": user["id"], "type": "reward", "description": "Redeemed · Touch n Go RM10", "amount": -10.00, "points": -1000, "kg": 0, "created_at": now},
            {"user_id": user["id"], "type": "dropoff", "description": "Cardboard · 5.0kg · 3R on Wheels", "amount": 1.75, "points": 175, "kg": 5.0, "created_at": now},
        ]
        await db.wallet_txns.insert_many(seed_txns)
    w.pop("_id", None)
    return w


@api_router.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    w = await _get_or_create_wallet(user)
    txns = await db.wallet_txns.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    for t in txns:
        t.pop("_id", None)
    return {"wallet": w, "transactions": txns}


@api_router.post("/wallet/dropoff")
async def wallet_dropoff(body: DropoffInput, user: dict = Depends(get_current_user)):
    await _get_or_create_wallet(user)
    rates = {r["id"]: r for r in sd.RECYCLING_RATES}
    total_rm, total_pts, total_kg, lines = 0.0, 0, 0.0, []
    for it in body.items:
        r = rates.get(it.id)
        if not r or it.weight <= 0:
            continue
        total_rm += r["rate"] * it.weight
        total_pts += int(r["points"] * it.weight)
        total_kg += it.weight
        lines.append(f"{r['item']} {it.weight}kg")
    total_rm = round(total_rm, 2)
    if not lines:
        raise HTTPException(status_code=400, detail="No valid items")
    center = next((c for c in sd.BUY_BACK_CENTERS if c["id"] == body.center_id), None)
    desc = " · ".join(lines) + (f" · {center['name']}" if center else "")
    now = datetime.now(timezone.utc).isoformat()
    await db.wallet_txns.insert_one({"user_id": user["id"], "type": "dropoff", "description": desc,
                                     "amount": total_rm, "points": total_pts, "kg": round(total_kg, 2), "created_at": now})
    await db.wallets.update_one({"user_id": user["id"]},
                                {"$inc": {"balance": total_rm, "points": total_pts, "total_kg": total_kg, "dropoffs": 1}})
    w = await _get_or_create_wallet(user)
    return {"credited_rm": total_rm, "credited_points": total_pts, "wallet": w}


@api_router.post("/wallet/convert")
async def wallet_convert(body: ConvertInput, user: dict = Depends(get_current_user)):
    w = await _get_or_create_wallet(user)
    if body.points <= 0 or body.points > w["points"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    rm = round(body.points / 100.0, 2)  # 100 pts = RM1
    now = datetime.now(timezone.utc).isoformat()
    label = "Cash payout to bank" if body.mode == "cash" else "Redeemed reward voucher"
    await db.wallet_txns.insert_one({"user_id": user["id"], "type": "reward",
                                     "description": f"{label} · {body.points} pts", "amount": rm if body.mode == "cash" else 0,
                                     "points": -body.points, "kg": 0, "created_at": now})
    inc = {"points": -body.points}
    if body.mode == "cash":
        inc["balance"] = rm
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": inc})
    w = await _get_or_create_wallet(user)
    return {"converted_rm": rm, "wallet": w}


# ---------- Citizen: upload + complaints ----------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    await db.files.insert_one({"storage_path": result["path"], "original_filename": file.filename,
                               "content_type": file.content_type, "size": result.get("size"),
                               "user_id": user["id"], "is_deleted": False,
                               "created_at": datetime.now(timezone.utc).isoformat()})
    return {"path": result["path"]}


@api_router.get("/files/{path:path}")
async def download_file(path: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type") or content_type)


@api_router.post("/complaints")
async def create_complaint(body: ComplaintInput, user: dict = Depends(get_current_user)):
    doc = {"category": body.category, "description": body.description, "lat": body.lat, "lng": body.lng,
           "address": body.address, "photo_path": body.photo_path, "status": "submitted",
           "reporter": user["name"], "reporter_id": user["id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.complaints.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api_router.get("/complaints")
async def list_complaints(user: dict = Depends(get_current_user)):
    query = {} if user["role"] == "planner" else {"reporter_id": user["id"]}
    docs = await db.complaints.find(query).sort("created_at", -1).to_list(200)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs


# ---------- Citizen: AI assistant (ChatGPT / OpenAI GPT-5.4) ----------
def _haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def _nearest_centers(lat, lng, n=3):
    ranked = []
    for c in sd.BUY_BACK_CENTERS:
        d = _haversine_km(lat, lng, c["lat"], c["lng"])
        ranked.append({**c, "distance_km": d})
    ranked.sort(key=lambda x: x["distance_km"])
    return ranked[:n]


CITIZEN_ASSISTANT_PROMPT = (
    "You are the SPARK Citizen Assistant, a friendly recycling helper for residents, businesses, schools and "
    "tourists in Sepang district, Selangor, Malaysia (Alam Flora recycling programme). "
    "You help people: find the NEAREST recycling centres from their location, understand which items are accepted, "
    "check current buy-back rates and how many reward points/RM they earn, know collection schedules, and how to "
    "report dumping. Reply in the SAME language the user writes in (English or Bahasa Malaysia). "
    "Be concise, warm and practical. When recommending centres, list them shortest-distance-first with the distance, "
    "type, opening hours and a Google Maps directions link if provided in context. "
    "Only use the facts given in the CONTEXT below — never invent centres, rates or hours. "
    "End location answers by inviting them to open the Locator tab for the map."
)


def _build_context(lat, lng):
    lines = ["=== CONTEXT (authoritative data) ==="]
    if lat is not None and lng is not None:
        lines.append(f"User location: {lat}, {lng}")
        lines.append("Nearest recycling centres (closest first):")
        for c in _nearest_centers(lat, lng):
            maps = f"https://www.google.com/maps/dir/?api=1&destination={c['lat']},{c['lng']}"
            lines.append(
                f"- {c['name']} ({c['type']}) — {c['distance_km']} km away · {c['hours']} · "
                f"accepts {', '.join(c['accepted'])} · phone {c['phone']} · directions: {maps}"
            )
    else:
        lines.append("User location: NOT shared. Ask them to enable location or open the Locator tab. "
                     "All Sepang centres:")
        for c in sd.BUY_BACK_CENTERS:
            lines.append(f"- {c['name']} ({c['type']}) · {c['hours']} · accepts {', '.join(c['accepted'])}")
    lines.append("Buy-back rates (RM per kg / points per kg): " +
                 "; ".join(f"{r['item']} RM{r['rate']:.2f}/{r['points']}pts" for r in sd.RECYCLING_RATES))
    lines.append("Collection schedule: " +
                 "; ".join(f"{s['type']} — {s['days']} ({s['next']})" for s in sd.COLLECTION_SCHEDULE))
    lines.append("Points conversion: 100 points = RM 1.00.")
    lines.append("=== END CONTEXT ===")
    return "\n".join(lines)


@api_router.post("/citizen/assistant")
async def citizen_assistant(body: AssistantInput, user: dict = Depends(get_current_user)):
    context = _build_context(body.lat, body.lng)
    full_message = f"{context}\n\nUser question: {body.message}"

    await db.assistant_messages.insert_one({
        "session_id": body.session_id, "role": "user", "content": body.message,
        "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})

    async def event_generator():
        collected = ""
        try:
            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=body.session_id,
                           system_message=CITIZEN_ASSISTANT_PROMPT).with_model("openai", "gpt-5.4")
            async for ev in chat.stream_message(UserMessage(text=full_message)):
                if isinstance(ev, TextDelta):
                    collected += ev.content
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"citizen assistant error: {e}")
            yield "Sorry, the assistant is temporarily unavailable. Please try again shortly."
        finally:
            await db.assistant_messages.insert_one({
                "session_id": body.session_id, "role": "assistant", "content": collected,
                "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})

    return StreamingResponse(event_generator(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.get("/citizen/nearest")
async def citizen_nearest(lat: float, lng: float, user: dict = Depends(get_current_user)):
    return _nearest_centers(lat, lng, n=len(sd.BUY_BACK_CENTERS))


# ---------- Reusable GeoJSON layer system ----------
def _clean_layer(doc):
    doc["id"] = doc.pop("_id") if "_id" in doc and isinstance(doc["_id"], str) else doc.get("id")
    doc.pop("_id", None)
    doc.pop("storage_path", None)
    return doc


@api_router.get("/geo/layers")
async def geo_layers(user: dict = Depends(get_current_user)):
    docs = await db.geo_layers.find({"is_deleted": {"$ne": True}}).sort("created_at", 1).to_list(200)
    return [_clean_layer(d) for d in docs]


@api_router.post("/geo/layers")
async def create_geo_layer(body: GeoLayerCreate, user: dict = Depends(get_current_user)):
    layer_id = str(uuid.uuid4())
    path = f"{APP_NAME}/geo/{user['id']}/{layer_id}.geojson"
    data = json.dumps(body.geojson).encode("utf-8")
    put_object(path, data, "application/json")
    n_features = len(body.geojson.get("features", []))
    doc = {"id": layer_id, "name": body.name, "description": body.description,
           "source": "upload", "url": None, "storage_path": path, "style": body.style,
           "feature_count": n_features, "builtin": False, "is_deleted": False,
           "owner_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.geo_layers.insert_one(doc)
    return _clean_layer(dict(doc))


@api_router.get("/geo/data/{layer_id}")
async def geo_data(layer_id: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    doc = await db.geo_layers.find_one({"id": layer_id, "is_deleted": {"$ne": True}})
    if not doc or not doc.get("storage_path"):
        raise HTTPException(status_code=404, detail="Layer data not found")
    data, ct = get_object(doc["storage_path"])
    return Response(content=data, media_type="application/json")


@api_router.delete("/geo/layers/{layer_id}")
async def delete_geo_layer(layer_id: str, user: dict = Depends(get_current_user)):
    doc = await db.geo_layers.find_one({"id": layer_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.get("builtin"):
        raise HTTPException(status_code=400, detail="Built-in layers cannot be deleted")
    await db.geo_layers.update_one({"id": layer_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


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
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
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
    await _seed_geo_layers()


def _waste_layer_config() -> dict:
    return {
        "id": "builtin-waste-recy",
        "name": "Annual Recyclable Waste",
        "description": "recy_annual_t (tonnes/year) · graduated 5-class",
        "source": "builtin", "url": "/geo/pop_waste.geojson", "storage_path": None,
        "builtin": True, "is_deleted": False, "feature_count": 344,
        "created_at": "2026-01-01T00:00:00+00:00",
        "style": {
            "mode": "graduated", "attribute": "recy_annual_t",
            "opacity": 0.65, "stroke": "#0b1220", "strokeWidth": 0.6,
            "labelAttr": "nama",
            "classes": [
                {"label": "Very Low · 0–19.16", "min": 0, "max": 19.16, "color": "#1a9850"},
                {"label": "Low · 19.16–30.47", "min": 19.16, "max": 30.47, "color": "#a6d96a"},
                {"label": "Moderate · 30.47–47.22", "min": 30.47, "max": 47.22, "color": "#fee08b"},
                {"label": "High · 47.22–83.02", "min": 47.22, "max": 83.02, "color": "#fc8d59"},
                {"label": "Critical · 83.02–194.62", "min": 83.02, "max": 194.62, "color": "#d73027"},
            ],
        },
    }


def _landuse_layer_config() -> dict:
    return {
        "id": "builtin-landuse",
        "name": "Current Land Use (Guna Tanah)",
        "description": "gtn1 land-use category · categorized",
        "source": "builtin", "url": "/geo/landuse_min.geojson", "storage_path": None,
        "builtin": True, "is_deleted": False, "feature_count": 12,
        "created_at": "2026-01-02T00:00:00+00:00",
        "style": {
            "mode": "categorized", "attribute": "gtn1",
            "opacity": 0.6, "stroke": "#334155", "strokeWidth": 0.8,
            "labelAttr": "gtn1",
            "categories": [
                {"value": "Tanah Lapang dan Rekreasi", "color": "#8EEA00"},
                {"value": "Tanah Kosong", "color": "#808000"},
                {"value": "Perumahan", "color": "#F4A582"},
                {"value": "Pertanian", "color": "#A6D785"},
                {"value": "Pengangkutan", "color": "#FFF200"},
                {"value": "Pantai", "color": "#A9DFF0"},
                {"value": "Komersial", "color": "#2878E8"},
                {"value": "Institusi dan Kemudahan Masyarakat", "color": "#F08080"},
                {"value": "Infrastruktur dan Utiliti", "color": "#FFFFFF", "outline": "#e11d48"},
                {"value": "Industri", "color": "#A875C8"},
                {"value": "Hutan", "color": "#168B2C"},
                {"value": "Badan Air", "color": "#12D9E5"},
            ],
        },
    }


async def _seed_geo_layers():
    for cfg in (_waste_layer_config(), _landuse_layer_config()):
        await db.geo_layers.update_one({"id": cfg["id"]}, {"$set": cfg}, upsert=True)


@app.on_event("shutdown")
async def shutdown():
    client.close()
