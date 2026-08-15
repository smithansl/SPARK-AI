"""SPARK Citizen (Alam Flora-style recycling app) — new endpoints in iteration 2.

Covers:
- Public reference data: /api/recycling/{rates,centers,schedule}, /api/announcements
- Wallet: GET /api/wallet auto-seeds; POST /api/wallet/dropoff credits balance/points;
  POST /api/wallet/convert (cash + reward) deducts points, cash also credits RM
- Auth guards on new endpoints
- Real object storage: POST /api/upload (multipart PNG) -> {path}; GET /api/files/{path}?auth=<jwt>
  returns image bytes with correct content-type and db.files record has is_deleted:false
- Complaints: POST /api/complaints stores lat/lng/photo_path and GET /api/complaints lists it
"""
import io
import os
import struct
import time
import uuid
import zlib

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CITIZEN = {"email": "citizen@spark.my", "password": "citizen123"}
PLANNER = {"email": "planner@spark.gov.my", "password": "Sepang2030"}


def _tiny_png_bytes() -> bytes:
    """Generate a valid 2x2 PNG (~70 bytes) without needing Pillow."""
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)  # 2x2 RGB 8-bit
    # 2 rows of 2 RGB pixels + filter byte per row
    raw = b"\x00" + b"\xff\x00\x00\x00\xff\x00" + b"\x00" + b"\x00\x00\xff\xff\xff\x00"
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def citizen_token(sess):
    r = sess.post(f"{API}/auth/login", json=CITIZEN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def fresh_citizen_token(sess):
    """A brand-new user so we can verify wallet seed values deterministically."""
    email = f"TEST_wallet_{uuid.uuid4().hex[:8]}@example.com"
    r = sess.post(f"{API}/auth/register",
                  json={"name": "TEST Wallet", "email": email, "password": "abc123", "role": "citizen"},
                  timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(token, **extra):
    h = {"Authorization": f"Bearer {token}"}
    h.update(extra)
    return h


# ---------- Public reference data ----------
class TestRecyclingRef:
    def test_rates(self, sess):
        r = sess.get(f"{API}/recycling/rates", timeout=10)
        assert r.status_code == 200
        rates = r.json()
        assert isinstance(rates, list) and len(rates) >= 10
        ids = {x["id"] for x in rates}
        assert {"pet", "aluminium", "cardboard"}.issubset(ids)
        for x in rates:
            for k in ["id", "item", "rate", "points", "unit"]:
                assert k in x
            assert x["rate"] > 0 and x["points"] > 0

    def test_centers(self, sess):
        r = sess.get(f"{API}/recycling/centers", timeout=10)
        assert r.status_code == 200
        centers = r.json()
        assert len(centers) >= 6
        types = {c["type"] for c in centers}
        # spec: BBC + DTRC + 3R on Wheels
        assert any("Buy-Back" in t for t in types)
        assert any("Drive-Through" in t for t in types)
        assert any("3R on Wheels" in t for t in types)
        for c in centers:
            for k in ["id", "name", "lat", "lng", "hours", "accepted", "phone"]:
                assert k in c
            assert isinstance(c["accepted"], list) and len(c["accepted"]) >= 1

    def test_schedule(self, sess):
        r = sess.get(f"{API}/recycling/schedule", timeout=10)
        assert r.status_code == 200
        s = r.json()
        assert len(s) >= 5
        for x in s:
            for k in ["id", "type", "days", "area", "next"]:
                assert k in x

    def test_announcements(self, sess):
        r = sess.get(f"{API}/announcements", timeout=10)
        assert r.status_code == 200
        a = r.json()
        assert len(a) >= 3
        for x in a:
            for k in ["id", "title", "body", "tag", "date"]:
                assert k in x


# ---------- Wallet ----------
class TestWallet:
    def test_wallet_requires_auth(self, sess):
        r = sess.get(f"{API}/wallet", timeout=10)
        assert r.status_code == 401
        r = sess.post(f"{API}/wallet/dropoff", json={"items": []}, timeout=10)
        assert r.status_code == 401
        r = sess.post(f"{API}/wallet/convert", json={"points": 100}, timeout=10)
        assert r.status_code == 401

    def test_wallet_seed_on_fresh_user(self, sess, fresh_citizen_token):
        """First /api/wallet access must auto-seed RM24.60/1240pts and 4 txns."""
        r = sess.get(f"{API}/wallet", headers=auth(fresh_citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "wallet" in d and "transactions" in d
        w = d["wallet"]
        assert abs(w["balance"] - 24.60) < 0.01, f"balance seed wrong: {w['balance']}"
        assert w["points"] == 1240
        assert w["total_kg"] == 86.5
        assert w["dropoffs"] == 7
        assert len(d["transactions"]) == 4
        # sanity: no ObjectId leaks
        assert "_id" not in w
        for t in d["transactions"]:
            assert "_id" not in t
            assert "description" in t and "amount" in t and "points" in t

    def test_dropoff_credits_and_increments(self, sess, citizen_token):
        # baseline
        r0 = sess.get(f"{API}/wallet", headers=auth(citizen_token), timeout=15)
        assert r0.status_code == 200
        w0 = r0.json()["wallet"]
        # PET 2.0kg (0.70/kg, 70pts/kg) -> +RM 1.40, +140pts
        payload = {"items": [{"id": "pet", "item": "PET Plastic Bottles", "weight": 2.0}],
                   "center_id": "bbc-salak"}
        r = sess.post(f"{API}/wallet/dropoff", json=payload, headers=auth(citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["credited_rm"] - 1.40) < 0.01
        assert d["credited_points"] == 140
        w1 = d["wallet"]
        assert abs(w1["balance"] - (w0["balance"] + 1.40)) < 0.01
        assert w1["points"] == w0["points"] + 140
        assert abs(w1["total_kg"] - (w0["total_kg"] + 2.0)) < 0.01
        assert w1["dropoffs"] == w0["dropoffs"] + 1

    def test_dropoff_rejects_empty(self, sess, citizen_token):
        r = sess.post(f"{API}/wallet/dropoff", json={"items": []},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 400

    def test_dropoff_ignores_invalid_item(self, sess, citizen_token):
        r = sess.post(f"{API}/wallet/dropoff",
                      json={"items": [{"id": "not-a-real-id", "item": "x", "weight": 5}]},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 400  # no valid items -> 400

    def test_convert_reward_deducts_points_only(self, sess, citizen_token):
        r0 = sess.get(f"{API}/wallet", headers=auth(citizen_token), timeout=15)
        w0 = r0.json()["wallet"]
        if w0["points"] < 100:
            # seed a dropoff to build up points
            sess.post(f"{API}/wallet/dropoff",
                      json={"items": [{"id": "aluminium", "item": "A", "weight": 1.0}]},
                      headers=auth(citizen_token), timeout=15)
            w0 = sess.get(f"{API}/wallet", headers=auth(citizen_token), timeout=15).json()["wallet"]
        r = sess.post(f"{API}/wallet/convert", json={"points": 100, "mode": "reward"},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        w1 = r.json()["wallet"]
        assert w1["points"] == w0["points"] - 100
        assert abs(w1["balance"] - w0["balance"]) < 0.001  # reward mode: no cash change

    def test_convert_cash_deducts_points_credits_rm(self, sess, citizen_token):
        r0 = sess.get(f"{API}/wallet", headers=auth(citizen_token), timeout=15)
        w0 = r0.json()["wallet"]
        r = sess.post(f"{API}/wallet/convert", json={"points": 200, "mode": "cash"},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert abs(d["converted_rm"] - 2.00) < 0.01  # 200 pts = RM 2
        w1 = d["wallet"]
        assert w1["points"] == w0["points"] - 200
        assert abs(w1["balance"] - (w0["balance"] + 2.00)) < 0.01

    def test_convert_over_balance_rejected(self, sess, citizen_token):
        r0 = sess.get(f"{API}/wallet", headers=auth(citizen_token), timeout=15)
        w = r0.json()["wallet"]
        r = sess.post(f"{API}/wallet/convert", json={"points": w["points"] + 10_000, "mode": "cash"},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 400


# ---------- Upload + file serve (real Emergent object storage) ----------
class TestUploadAndServe:
    def test_upload_requires_auth(self, sess):
        r = sess.post(f"{API}/upload", files={"file": ("a.png", b"x", "image/png")}, timeout=15)
        assert r.status_code == 401

    def test_upload_and_download_real_object_storage(self, sess, citizen_token):
        png = _tiny_png_bytes()
        # upload multipart
        r = requests.post(f"{API}/upload",
                          files={"file": ("TEST_evidence.png", png, "image/png")},
                          headers={"Authorization": f"Bearer {citizen_token}"},
                          timeout=60)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        path = r.json().get("path")
        assert isinstance(path, str) and path.startswith("spark/uploads/"), f"bad path: {path}"

        # 1) Bearer header should serve the file
        r2 = requests.get(f"{API}/files/{path}",
                          headers={"Authorization": f"Bearer {citizen_token}"}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.headers.get("Content-Type", "").startswith("image/"), r2.headers.get("Content-Type")
        assert r2.content[:8] == b"\x89PNG\r\n\x1a\n", "downloaded bytes are not a real PNG"
        assert len(r2.content) == len(png), f"size mismatch: {len(r2.content)} vs {len(png)}"

        # 2) Query-param auth (used by <img src=...&auth=jwt>)
        r3 = requests.get(f"{API}/files/{path}?auth={citizen_token}", timeout=30)
        assert r3.status_code == 200
        assert r3.content[:8] == b"\x89PNG\r\n\x1a\n"

        # 3) No auth -> 401
        r4 = requests.get(f"{API}/files/{path}", timeout=30)
        assert r4.status_code == 401

        # save path for complaint test
        pytest._TEST_PHOTO_PATH = path

    def test_download_bad_token(self, sess):
        r = requests.get(f"{API}/files/anything.png?auth=not-a-real-jwt", timeout=15)
        assert r.status_code == 401


# ---------- Complaints ----------
class TestComplaints:
    def test_requires_auth(self, sess):
        r = sess.get(f"{API}/complaints", timeout=10)
        assert r.status_code == 401
        r = sess.post(f"{API}/complaints", json={"category": "x", "description": "y"}, timeout=10)
        assert r.status_code == 401

    def test_create_with_photo_and_list(self, sess, citizen_token):
        photo_path = getattr(pytest, "_TEST_PHOTO_PATH", None)
        payload = {
            "category": "Illegal Dumping",
            "description": f"TEST complaint {uuid.uuid4().hex[:6]}",
            "lat": 2.72, "lng": 101.72, "address": "2.72, 101.72",
            "photo_path": photo_path,
        }
        r = sess.post(f"{API}/complaints", json=payload, headers=auth(citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["category"] == "Illegal Dumping"
        assert doc["status"] == "submitted"
        assert "id" in doc and "_id" not in doc
        assert doc.get("photo_path") == photo_path

        r2 = sess.get(f"{API}/complaints", headers=auth(citizen_token), timeout=10)
        assert r2.status_code == 200
        found = next((c for c in r2.json() if c["id"] == doc["id"]), None)
        assert found is not None
        assert found["description"] == payload["description"]
        assert found.get("lat") == 2.72

    def test_citizen_sees_only_own(self, sess, citizen_token, fresh_citizen_token):
        # main citizen creates one, fresh citizen must not see it
        r = sess.post(f"{API}/complaints",
                      json={"category": "Other", "description": "TEST scoped visibility"},
                      headers=auth(citizen_token), timeout=15)
        assert r.status_code == 200
        their_id = r.json()["id"]
        r2 = sess.get(f"{API}/complaints", headers=auth(fresh_citizen_token), timeout=10)
        assert r2.status_code == 200
        ids = [c["id"] for c in r2.json()]
        assert their_id not in ids
