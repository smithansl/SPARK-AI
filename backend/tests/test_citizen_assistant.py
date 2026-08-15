"""Iteration 3 — SPARK Citizen AI Assistant (ChatGPT / OpenAI GPT-5.4) + nearest endpoint.

Covers:
- GET /api/citizen/nearest — auth required, returns all 6 centres sorted by haversine ascending
- POST /api/citizen/assistant — auth required, streams a real GPT-5.4 reply (text/plain).
  Verifies: streaming works, grounded on provided centres (does not invent names),
  nearest-first ordering when lat/lng given (Sepang town 2.69,101.75 -> '3R on Wheels · Sepang Town Stop'),
  answers rate/schedule questions from context.
"""
import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CITIZEN = {"email": "citizen@spark.my", "password": "citizen123"}

# Sepang town centre coordinates (per iteration handoff note)
SEPANG_LAT, SEPANG_LNG = 2.69, 101.75
EXPECTED_NEAREST_NAME = "3R on Wheels · Sepang Town Stop"

# All 6 real centres per sepang_data.BUY_BACK_CENTERS
KNOWN_CENTER_NAMES = {
    "Alam Flora BBC Salak Tinggi",
    "Alam Flora BBC KLIA",
    "Drive-Through Recycling · Kota Warisan",
    "3R on Wheels · Dengkil Stop",
    "3R on Wheels · Sepang Town Stop",
    "Alam Flora BBC Sungai Pelek",
}


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


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- /api/citizen/nearest ----------
class TestNearest:
    def test_requires_auth(self, sess):
        r = sess.get(f"{API}/citizen/nearest", params={"lat": SEPANG_LAT, "lng": SEPANG_LNG}, timeout=10)
        assert r.status_code == 401

    def test_returns_all_six_sorted_ascending(self, sess, citizen_token):
        r = sess.get(f"{API}/citizen/nearest",
                     params={"lat": SEPANG_LAT, "lng": SEPANG_LNG},
                     headers=_auth(citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 6, f"expected 6 centres, got {len(data)}"

        # every centre has a distance_km field
        for c in data:
            assert "distance_km" in c
            assert isinstance(c["distance_km"], (int, float))
            assert c["distance_km"] >= 0
            assert "name" in c and "lat" in c and "lng" in c
            assert c["name"] in KNOWN_CENTER_NAMES, f"unknown centre: {c['name']}"
            assert "_id" not in c  # no ObjectId leaks

        # ascending order
        distances = [c["distance_km"] for c in data]
        assert distances == sorted(distances), f"distances not ascending: {distances}"

        # nearest to Sepang town should be the Sepang Town 3R stop
        assert data[0]["name"] == EXPECTED_NEAREST_NAME, (
            f"nearest should be '{EXPECTED_NEAREST_NAME}', got '{data[0]['name']}' "
            f"({data[0]['distance_km']} km)"
        )
        # sanity: it is really close (<1 km)
        assert data[0]["distance_km"] < 1.0, f"nearest too far: {data[0]['distance_km']} km"

    def test_haversine_distances_reasonable(self, sess, citizen_token):
        """Furthest of 6 Sepang centres should be under ~30 km from Sepang town."""
        r = sess.get(f"{API}/citizen/nearest",
                     params={"lat": SEPANG_LAT, "lng": SEPANG_LNG},
                     headers=_auth(citizen_token), timeout=15)
        data = r.json()
        assert data[-1]["distance_km"] < 30.0, f"furthest too far: {data[-1]['distance_km']}"


# ---------- /api/citizen/assistant (streaming ChatGPT GPT-5.4) ----------
class TestAssistantStreaming:
    def test_requires_auth(self, sess):
        r = sess.post(f"{API}/citizen/assistant",
                      json={"message": "hi", "session_id": "x"}, timeout=15)
        assert r.status_code == 401

    def _stream(self, token, message, lat=None, lng=None, timeout=120):
        payload = {"message": message, "session_id": f"test-{uuid.uuid4().hex[:8]}"}
        if lat is not None:
            payload["lat"] = lat
        if lng is not None:
            payload["lng"] = lng
        t0 = time.time()
        r = requests.post(
            f"{API}/citizen/assistant",
            json=payload,
            headers={**_auth(token), "Content-Type": "application/json", "Accept": "text/plain"},
            stream=True,
            timeout=timeout,
        )
        assert r.status_code == 200, f"status {r.status_code}: {r.text}"
        assert r.headers.get("Content-Type", "").startswith("text/plain"), r.headers.get("Content-Type")
        collected = ""
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                collected += chunk
        elapsed = time.time() - t0
        return collected, elapsed

    def test_nearest_query_lists_sepang_town_first(self, citizen_token):
        text, elapsed = self._stream(
            citizen_token,
            "Find the nearest recycling centre to me. List the top 3 closest first with distance.",
            lat=SEPANG_LAT, lng=SEPANG_LNG,
        )
        assert len(text) > 40, f"reply too short ({len(text)} chars): {text!r}"
        assert "temporarily unavailable" not in text.lower(), f"fallback served: {text!r}"

        # Grounded: reply must mention the actual closest centre and NOT invent names.
        low = text.lower()
        assert "sepang town" in low or "3r on wheels" in low, (
            f"nearest centre '{EXPECTED_NEAREST_NAME}' not mentioned. Reply: {text!r}"
        )
        # It should also mention a distance in km somewhere (nearest ~0.something km)
        assert re.search(r"\d+(\.\d+)?\s*km", low), f"no km distance mentioned: {text!r}"
        # And should include a directions link (google maps URL from context)
        assert "google.com/maps" in low or "directions" in low, f"no directions link/word: {text!r}"

        print(f"[nearest reply {elapsed:.1f}s]\n{text[:600]}")

    def test_grounded_does_not_invent_centres(self, citizen_token):
        text, elapsed = self._stream(
            citizen_token,
            "List all recycling centres in Sepang with their opening hours.",
            lat=SEPANG_LAT, lng=SEPANG_LNG,
        )
        assert len(text) > 60, f"reply too short: {text!r}"
        # Look for obviously invented centre name patterns that are NOT in our data
        forbidden = ["Petaling", "Shah Alam", "Kuala Lumpur City", "Klang Central Recycling"]
        low = text.lower()
        for bad in forbidden:
            assert bad.lower() not in low, f"model invented '{bad}': {text!r}"
        # at least 2 real centres from our dataset should appear
        real_hits = sum(1 for n in KNOWN_CENTER_NAMES if n.lower() in low or n.split(" · ")[-1].lower() in low)
        assert real_hits >= 2, f"only {real_hits} real centres mentioned, reply: {text!r}"
        print(f"[grounded reply {elapsed:.1f}s] hits={real_hits}\n{text[:600]}")

    def test_rate_question(self, citizen_token):
        text, elapsed = self._stream(
            citizen_token,
            "What is the current buy-back rate per kilogram for aluminium cans? Just give the RM value.",
        )
        assert len(text) > 5
        # RECYCLING_RATES aluminium rate is RM 4.50/kg -> reply must contain 4.50 (or 4.5)
        assert "4.5" in text, f"expected RM 4.50 mention, got: {text!r}"
        print(f"[rate reply {elapsed:.1f}s]\n{text[:400]}")

    def test_schedule_question(self, citizen_token):
        text, elapsed = self._stream(
            citizen_token,
            "When is recyclables (3R) collection day in Sepang?",
        )
        assert len(text) > 10
        # COLLECTION_SCHEDULE: Recyclables 3R -> Tuesday
        assert "tuesday" in text.lower() or "tue" in text.lower(), (
            f"expected Tuesday, got: {text!r}"
        )
        print(f"[schedule reply {elapsed:.1f}s]\n{text[:400]}")

    def test_no_location_still_answers(self, citizen_token):
        """When location is not shared, backend still answers using all centres."""
        text, elapsed = self._stream(
            citizen_token,
            "Can you tell me generally where I can recycle e-waste in Sepang?",
        )
        assert len(text) > 40
        assert "temporarily unavailable" not in text.lower(), f"fallback served: {text!r}"
        low = text.lower()
        # Should mention at least one real centre from our data (many accept e-waste)
        hits = sum(1 for n in KNOWN_CENTER_NAMES if n.split(" · ")[-1].lower() in low)
        assert hits >= 1, f"no real centre mentioned in no-location reply: {text!r}"
        print(f"[no-loc reply {elapsed:.1f}s]\n{text[:400]}")
