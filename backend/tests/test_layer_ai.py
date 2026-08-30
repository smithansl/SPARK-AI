"""Iteration 5 backend tests: layer_analysis + /api/ai/chat with layer_ids."""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "planner@spark.gov.my", "password": "Sepang2030"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- direct layer_analysis unit checks (from backend module) ---
def test_compute_insights_hotzone_dominant_komersial():
    import sys
    sys.path.insert(0, "/app/backend")
    import layer_analysis
    ins = layer_analysis.compute_insights()

    # waste_classes counts sum to 344
    total_count = sum(c["count"] for c in ins["waste_classes"])
    assert total_count == 344, f"expected 344 total zones, got {total_count}"

    # hotzone_dominant top = Komersial ~43%
    top = ins["hotzone_dominant"][0]
    assert top["category"] == "Komersial", f"top hotzone cat={top}"
    assert 38 <= top["pct"] <= 48, f"komersial pct={top['pct']}"

    # Critical class 100% Komersial
    critical = ins["per_class_dominant"].get("Critical", [])
    assert critical, "no Critical class dominant data"
    assert critical[0]["category"] == "Komersial"
    assert critical[0]["pct"] == 100


def test_layer_context_text_mentions_komersial():
    import layer_analysis
    txt = layer_analysis.layer_context_text(["builtin-waste-recy", "builtin-landuse"])
    assert "Komersial" in txt
    assert "CROSS-ANALYSIS" in txt
    assert "HIGH+CRITICAL" in txt


# --- integration: streamed /api/ai/chat grounded in layers ---
def test_ai_chat_with_layer_ids_streams_komersial(auth_headers):
    payload = {
        "message": "Which land use dominates the critical waste zones?",
        "session_id": "test-iter5-" + os.urandom(3).hex(),
        "layer_ids": ["builtin-waste-recy", "builtin-landuse"],
    }
    r = requests.post(f"{API}/ai/chat", headers=auth_headers, json=payload,
                      stream=True, timeout=90)
    assert r.status_code == 200, r.text
    chunks = []
    for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
        if chunk:
            chunks.append(chunk)
    body = "".join(chunks)
    assert len(body) > 50, f"stream too short: {body!r}"
    # Must reference Komersial (grounded in real overlay)
    assert "Komersial" in body, f"answer missing Komersial: {body[:500]}"
    # Structured sections
    assert "EVIDENCE" in body and "RECOMMENDATION" in body


def test_ai_chat_without_layer_ids_still_works(auth_headers):
    payload = {"message": "Give one recommendation for Sepang waste.",
               "session_id": "test-iter5b-" + os.urandom(3).hex()}
    r = requests.post(f"{API}/ai/chat", headers=auth_headers, json=payload,
                      stream=True, timeout=90)
    assert r.status_code == 200
    body = "".join(r.iter_content(chunk_size=None, decode_unicode=True))
    assert "RECOMMENDATION" in body


def test_ai_history_persists(auth_headers):
    sid = "test-iter5hist-" + os.urandom(3).hex()
    r = requests.post(f"{API}/ai/chat", headers=auth_headers,
                      json={"message": "hi", "session_id": sid,
                            "layer_ids": ["builtin-waste-recy", "builtin-landuse"]},
                      stream=True, timeout=90)
    _ = "".join(r.iter_content(chunk_size=None, decode_unicode=True))
    r2 = requests.get(f"{API}/ai/history/{sid}", headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    hist = r2.json()
    assert len(hist) >= 2
    assert hist[0]["role"] == "user"
    assert hist[1]["role"] == "assistant"
