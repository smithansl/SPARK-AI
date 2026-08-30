"""Backend tests for SPARK iteration 4: GeoJSON layers system + AI chat history."""
import os
import json
import time
import pytest
import requests

def _load_backend_url():
    url = os.environ.get('REACT_APP_BACKEND_URL')
    if url:
        return url.rstrip('/')
    # Fall back to frontend/.env
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', '.env')
    with open(os.path.abspath(path)) as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                return line.split('=', 1)[1].strip().rstrip('/')
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

PLANNER = {"email": "planner@spark.gov.my", "password": "Sepang2030"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json=PLANNER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Built-in geo layers ----------
class TestGeoLayersBuiltins:
    def test_list_layers_contains_two_builtins(self, headers):
        r = requests.get(f"{API}/geo/layers", headers=headers, timeout=20)
        assert r.status_code == 200
        layers = r.json()
        ids = {l["id"] for l in layers}
        assert "builtin-waste-recy" in ids
        assert "builtin-landuse" in ids

    def test_waste_recy_style_graduated_5_classes(self, headers):
        r = requests.get(f"{API}/geo/layers", headers=headers, timeout=20)
        waste = next(l for l in r.json() if l["id"] == "builtin-waste-recy")
        assert waste["style"]["mode"] == "graduated"
        assert waste["style"]["attribute"] == "recy_annual_t"
        cls = waste["style"]["classes"]
        assert len(cls) == 5
        # expected breaks
        expected = [19.16, 30.47, 47.22, 83.02, 194.62]
        assert [c["max"] for c in cls] == expected
        # expected colors green -> red
        colors = [c["color"] for c in cls]
        assert colors == ["#1a9850", "#a6d96a", "#fee08b", "#fc8d59", "#d73027"]

    def test_landuse_categorized_exact_categories(self, headers):
        r = requests.get(f"{API}/geo/layers", headers=headers, timeout=20)
        landuse = next(l for l in r.json() if l["id"] == "builtin-landuse")
        assert landuse["style"]["mode"] == "categorized"
        assert landuse["style"]["attribute"] == "gtn1"
        cats = [c["value"] for c in landuse["style"]["categories"]]
        expected = [
            "Tanah Lapang dan Rekreasi", "Tanah Kosong", "Perumahan", "Pertanian",
            "Pengangkutan", "Pantai", "Komersial",
            "Institusi dan Kemudahan Masyarakat", "Infrastruktur dan Utiliti",
            "Industri", "Hutan", "Badan Air",
        ]
        assert cats == expected

    def test_delete_builtin_forbidden(self, headers):
        r = requests.delete(f"{API}/geo/layers/builtin-waste-recy", headers=headers, timeout=20)
        assert r.status_code == 400

    def test_layers_require_auth(self):
        r = requests.get(f"{API}/geo/layers", timeout=20)
        assert r.status_code in (401, 403)


# ---------- Upload / create / delete uploaded layer ----------
class TestGeoLayerUpload:
    tiny_geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"name": "TEST_A", "score": 42},
            "geometry": {"type": "Polygon", "coordinates": [[
                [101.7, 2.7], [101.71, 2.7], [101.71, 2.71], [101.7, 2.71], [101.7, 2.7]
            ]]}
        }]
    }

    def test_create_upload_and_serve_and_delete(self, headers, token):
        payload = {
            "name": "TEST_upload_layer",
            "description": "test",
            "geojson": self.tiny_geojson,
            "style": {"mode": "categorized", "attribute": "name",
                      "opacity": 0.6, "stroke": "#000", "strokeWidth": 0.5,
                      "categories": [{"value": "TEST_A", "color": "#ff0000"}]},
        }
        r = requests.post(f"{API}/geo/layers", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        layer = r.json()
        assert layer["name"] == "TEST_upload_layer"
        assert layer["feature_count"] == 1
        assert layer.get("builtin") in (False, None)
        assert "_id" not in layer
        assert "storage_path" not in layer
        lid = layer["id"]

        # verify listed
        r2 = requests.get(f"{API}/geo/layers", headers=headers, timeout=20)
        assert any(l["id"] == lid for l in r2.json())

        # fetch data via query auth param (as frontend uses)
        r3 = requests.get(f"{API}/geo/data/{lid}?auth={token}", timeout=30)
        assert r3.status_code == 200
        data = r3.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1
        assert data["features"][0]["properties"]["name"] == "TEST_A"

        # data endpoint rejects without auth
        r4 = requests.get(f"{API}/geo/data/{lid}", timeout=20)
        assert r4.status_code == 401

        r5 = requests.get(f"{API}/geo/data/{lid}?auth=bogus", timeout=20)
        assert r5.status_code == 401

        # delete (soft) uploaded layer
        r6 = requests.delete(f"{API}/geo/layers/{lid}", headers=headers, timeout=20)
        assert r6.status_code == 200

        # no longer listed
        r7 = requests.get(f"{API}/geo/layers", headers=headers, timeout=20)
        assert not any(l["id"] == lid for l in r7.json())


# ---------- AI chat history persistence ----------
class TestAiChatHistory:
    def test_history_empty_session_returns_list(self, headers):
        r = requests.get(f"{API}/ai/history/nonexistent-session-xyz", headers=headers, timeout=20)
        assert r.status_code == 200
        assert r.json() == []

    def test_chat_then_history_returns_messages(self, headers):
        import secrets
        sid = "test-hist-" + secrets.token_hex(4)
        # send a very short prompt to keep streaming fast
        payload = {"session_id": sid, "message": "Reply with the single word: OK"}
        with requests.post(f"{API}/ai/chat", json=payload, headers=headers, stream=True, timeout=90) as rr:
            assert rr.status_code == 200
            # consume the stream
            collected = ""
            for chunk in rr.iter_content(chunk_size=None):
                if chunk:
                    collected += chunk.decode("utf-8", errors="ignore")
            assert len(collected) > 0

        # brief wait for the background persistence
        time.sleep(1.0)
        r = requests.get(f"{API}/ai/history/{sid}", headers=headers, timeout=20)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles
        assert "assistant" in roles
        # first message should be the user's
        assert msgs[0]["role"] == "user"
        assert "OK" in msgs[0]["content"] or "single word" in msgs[0]["content"]
