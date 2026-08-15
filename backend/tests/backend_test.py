"""SPARK backend API tests.

Covers:
- Auth (register, login, /me)
- Public data endpoints (kpis, zones, forecast, sites, routes, correlation, facilities)
- Role guarding on /api/reports (auth required)
- POST /api/reports (create + list)
- POST /api/simulate  (returns deterministic impacts + Claude recommendation string)
- POST /api/ai/chat (streaming Claude text/plain)
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

PLANNER = {"email": "planner@spark.gov.my", "password": "Sepang2030"}
CITIZEN = {"email": "citizen@spark.my", "password": "citizen123"}


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def planner_token(sess):
    r = sess.post(f"{API}/auth/login", json=PLANNER, timeout=15)
    assert r.status_code == 200, f"planner login failed {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def citizen_token(sess):
    r = sess.post(f"{API}/auth/login", json=CITIZEN, timeout=15)
    assert r.status_code == 200, f"citizen login failed {r.status_code} {r.text}"
    return r.json()["token"]


def auth_hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_root(self, sess):
        r = sess.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "SPARK" in r.json().get("message", "")

    def test_login_planner(self, sess):
        r = sess.post(f"{API}/auth/login", json=PLANNER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "planner"
        assert d["user"]["email"] == PLANNER["email"]
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_login_citizen(self, sess):
        r = sess.post(f"{API}/auth/login", json=CITIZEN, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "citizen"

    def test_login_wrong_password(self, sess):
        r = sess.post(f"{API}/auth/login",
                      json={"email": PLANNER["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_token(self, sess):
        r = sess.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_returns_user(self, sess, planner_token):
        r = sess.get(f"{API}/auth/me", headers=auth_hdr(planner_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == PLANNER["email"] and d["role"] == "planner"
        assert "password_hash" not in d

    def test_register_new_citizen(self, sess):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = sess.post(f"{API}/auth/register",
                      json={"name": "TEST User", "email": email, "password": "abc123", "role": "citizen"},
                      timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == email
        assert d["user"]["role"] == "citizen"
        assert d["token"]

    def test_register_duplicate(self, sess):
        r = sess.post(f"{API}/auth/register",
                      json={"name": "Planner", "email": PLANNER["email"], "password": "abc123", "role": "planner"},
                      timeout=15)
        assert r.status_code == 400


# ---------- Spatial data ----------
class TestSpatialData:
    def test_kpis(self, sess):
        r = sess.get(f"{API}/kpis", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_waste_tonnes", "growth_2030", "recovery_rate", "critical_hotspots", "population"]:
            assert k in d
        assert d["total_waste_tonnes"] > 0

    def test_zones(self, sess):
        r = sess.get(f"{API}/zones", timeout=10)
        assert r.status_code == 200
        zones = r.json()
        assert isinstance(zones, list) and len(zones) >= 8
        for z in zones:
            for k in ["id", "name", "lat", "lng", "population", "waste_tonnes", "severity"]:
                assert k in z, f"zone missing {k}: {z}"

    def test_zone_detail(self, sess):
        r = sess.get(f"{API}/zones/labu-lanjut", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == "labu-lanjut"

    def test_zone_404(self, sess):
        r = sess.get(f"{API}/zones/nonexistent", timeout=10)
        assert r.status_code == 404

    def test_forecast(self, sess):
        r = sess.get(f"{API}/forecast", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["years"][0] == 2026 and 2035 in d["years"]
        assert len(d["trend_series"]) >= 5
        assert "alert" in d

    def test_sites(self, sess):
        r = sess.get(f"{API}/sites", timeout=10)
        assert r.status_code == 200
        sites = r.json()
        assert len(sites) >= 3
        for s in sites:
            assert "score" in s and "pros" in s and "constraints" in s

    def test_routes(self, sess):
        r = sess.get(f"{API}/routes", timeout=10)
        assert r.status_code == 200
        routes = r.json()
        assert len(routes) >= 3
        for rt in routes:
            assert "stop_coords" in rt and len(rt["stop_coords"]) >= 2
            for s in rt["stop_coords"]:
                assert "lat" in s and "lng" in s

    def test_correlation(self, sess):
        r = sess.get(f"{API}/correlation", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "statement" in d and "%" in d["statement"]

    def test_facilities(self, sess):
        r = sess.get(f"{API}/facilities", timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 3


# ---------- Citizen reports ----------
class TestReports:
    def test_reports_requires_auth(self, sess):
        r = sess.get(f"{API}/reports", timeout=10)
        assert r.status_code == 401
        r = sess.post(f"{API}/reports", json={"zone_id": "labu-lanjut", "waste_type": "Plastic",
                                              "description": "x", "severity": "low"}, timeout=10)
        assert r.status_code == 401

    def test_create_and_list_report(self, sess, citizen_token):
        payload = {"zone_id": "labu-lanjut", "waste_type": "Plastic",
                   "description": f"TEST report {uuid.uuid4().hex[:6]}", "severity": "high"}
        r = sess.post(f"{API}/reports", json=payload, headers=auth_hdr(citizen_token), timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["zone_id"] == payload["zone_id"]
        assert doc["waste_type"] == "Plastic"
        assert "id" in doc and "_id" not in doc  # object id must not leak
        # list
        r2 = sess.get(f"{API}/reports", headers=auth_hdr(citizen_token), timeout=10)
        assert r2.status_code == 200
        ids = [d["id"] for d in r2.json()]
        assert doc["id"] in ids

    def test_planner_sees_all_reports(self, sess, planner_token):
        r = sess.get(f"{API}/reports", headers=auth_hdr(planner_token), timeout=10)
        assert r.status_code == 200


# ---------- Simulate + AI ----------
class TestSimulate:
    def test_simulate_returns_impacts_and_ai_recommendation(self, sess):
        payload = {"population_growth": 25, "recycling_rate": 30, "new_housing": 800, "new_commercial": True}
        # Simulate calls Claude — allow generous timeout
        r = sess.post(f"{API}/simulate", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["projected_waste", "waste_increase_pct", "collection_demand_pct",
                  "capacity_gap_hubs", "traffic_impact_pct", "affected_zone", "recommendation"]:
            assert k in d, f"missing {k}"
        # deterministic core:
        # waste_increase = 25*1.2 + (800/500)*3 + 6 = 30 + 4.8 + 6 = 40.8
        assert abs(d["waste_increase_pct"] - 40.8) < 0.5
        # recommendation must be non-empty real AI text (not a canned "engine unavailable" line)
        rec = d["recommendation"]
        assert isinstance(rec, str) and len(rec) > 30, f"weak recommendation: {rec!r}"
        # print for evidence
        print("SIM RECOMMENDATION:", rec[:500])

    def test_simulate_low_growth_zone(self, sess):
        payload = {"population_growth": 5, "recycling_rate": 20, "new_housing": 100, "new_commercial": False}
        r = sess.post(f"{API}/simulate", json=payload, timeout=90)
        assert r.status_code == 200
        assert "Labu Lanjut" in r.json()["affected_zone"]


class TestAIChat:
    def test_chat_requires_auth(self, sess):
        r = sess.post(f"{API}/ai/chat", json={"message": "hi", "session_id": "s1"}, timeout=15)
        assert r.status_code == 401

    def test_chat_streams_structured_response(self, sess, planner_token):
        payload = {"message": "Where should we place a new recycling hub in Sepang?",
                   "session_id": f"test-{uuid.uuid4().hex[:8]}"}
        # streaming plain text
        with sess.post(f"{API}/ai/chat", json=payload,
                       headers=auth_hdr(planner_token), timeout=120, stream=True) as r:
            assert r.status_code == 200, r.text
            assert "text/plain" in r.headers.get("content-type", "")
            chunks = []
            start = time.time()
            for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    chunks.append(chunk)
                if time.time() - start > 90:
                    break
            text = "".join(chunks)
        assert len(text) > 100, f"short reply {text!r}"
        # Structured Claude output should contain at least 2 of the 4 headings
        headings = ["EVIDENCE", "ANALYSIS", "PROJECTION", "RECOMMENDATION"]
        found = [h for h in headings if h in text.upper()]
        assert len(found) >= 2, f"missing structure. Found {found}. Text: {text[:400]}"
        print("CHAT REPLY EXCERPT:", text[:600])

    def test_chat_arithmetic_probe(self, sess, planner_token):
        """Silent-fallback guard — use an in-domain checkable prompt because the
        assistant is persona-locked to Sepang planning. Ask for a specific numeric
        figure from the system prompt: total district waste ~42.8 t/month."""
        payload = {"message": "What is the current total district waste in tonnes per month? "
                              "Reply with only the number (one decimal).",
                   "session_id": f"probe-{uuid.uuid4().hex[:8]}"}
        with sess.post(f"{API}/ai/chat", json=payload,
                       headers=auth_hdr(planner_token), timeout=120, stream=True) as r:
            assert r.status_code == 200
            chunks = []
            start = time.time()
            for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    chunks.append(chunk)
                if time.time() - start > 60:
                    break
            text = "".join(chunks)
        # Must contain the number from system prompt (42.8) — canned fallback would not.
        assert "42.8" in text, f"LLM likely not called. Reply: {text[:400]}"
        assert "temporarily unavailable" not in text.lower()
        print("PROBE REPLY EXCERPT:", text[:400])
