from datetime import datetime, timezone, timedelta
import os
import pytest
from fastapi.testclient import TestClient

from main import (
    app,
    init_db,
    connect,
    calculate_freshness,
    calculate_eta,
    OPERATOR_KEY
)

client = TestClient(app)
AUTH_HEADERS = {"X-Operator-Key": OPERATOR_KEY}


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


# --- Health & System Status Tests ---

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Campus Transit API"}


def test_system_status_disclosures():
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["demo_mode"] is True
    # Verify honest external integration disclosure
    assert "integrations" in data
    assert data["integrations"]["digii_campus"]["status"] == "unavailable"
    assert "Approved API documentation/access was not available" in data["integrations"]["digii_campus"]["disclosure"]
    assert "freshness_thresholds" in data


# --- Route & Bus Query Tests ---

def test_list_buses_returns_enriched_seeded_routes():
    response = client.get("/api/buses")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 4
    for bus in data:
        assert "bus_code" in bus
        assert "scheduled_arrival" in bus
        assert "freshness" in bus
        assert "is_stale" in bus
        assert "eta_type" in bus
        assert "eta_display" in bus


def test_list_buses_filter_by_status():
    response = client.get("/api/buses?status=Delayed")
    assert response.status_code == 200
    data = response.json()
    for bus in data:
        assert bus["status"] == "Delayed"


def test_get_bus_by_id_success():
    response = client.get("/api/buses/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "updates" in data
    assert isinstance(data["updates"], list)
    assert len(data["updates"]) >= 1
    first_update = data["updates"][0]
    assert "is_correction" in first_update
    assert "supersedes_update_id" in first_update


def test_get_bus_unknown_id_returns_404():
    response = client.get("/api/buses/9999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Bus not found"


# --- Operator Authorization Tests ---

def test_post_update_unauthorized_without_header():
    payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Traffic delay without auth",
        "updated_by": "Rider Anonymous"
    }
    response = client.post("/api/buses/1/updates", json=payload)
    assert response.status_code == 401
    assert "Operator authorization required" in response.json()["detail"]


def test_post_update_unauthorized_with_wrong_key():
    payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Traffic delay with invalid key",
        "updated_by": "Rider Anonymous"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers={"X-Operator-Key": "wrong-key"})
    assert response.status_code == 401


# --- Publishing Disruption Updates & Validation ---

def test_post_valid_disruption_update():
    payload = {
        "status": "Delayed",
        "delay_minutes": 20,
        "note": "Traffic delay near campus entrance.",
        "updated_by": "Desk Officer A"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["bus_id"] == 1
    assert res_data["status"] == "Delayed"
    assert res_data["delay_minutes"] == 20
    assert res_data["note"] == payload["note"]
    assert res_data["is_correction"] is False
    assert res_data["supersedes_update_id"] is None

    # Verify latest bus status updated with estimated arrival
    bus_res = client.get("/api/buses/1")
    assert bus_res.status_code == 200
    bus_data = bus_res.json()
    assert bus_data["status"] == "Delayed"
    assert bus_data["delay_minutes"] == 20
    assert bus_data["eta_type"] == "estimated"
    # Scheduled is 08:15 + 20m delay = 08:35
    assert bus_data["estimated_arrival"] == "08:35"


def test_post_update_invalid_status():
    payload = {
        "status": "Speeding",
        "delay_minutes": 10,
        "note": "Invalid status test note",
        "updated_by": "Desk Officer"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422


def test_post_update_invalid_delay_bounds():
    # Negative delay
    res1 = client.post("/api/buses/1/updates", json={
        "status": "Delayed", "delay_minutes": -5, "note": "Negative delay", "updated_by": "Desk Officer"
    }, headers=AUTH_HEADERS)
    assert res1.status_code == 422

    # Delay exceeds 240m
    res2 = client.post("/api/buses/1/updates", json={
        "status": "Delayed", "delay_minutes": 300, "note": "Excessive delay", "updated_by": "Desk Officer"
    }, headers=AUTH_HEADERS)
    assert res2.status_code == 422


def test_post_update_short_note():
    payload = {
        "status": "Delayed",
        "delay_minutes": 10,
        "note": "No",  # Minimum 4 characters required
        "updated_by": "Desk Officer"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422


def test_post_update_unknown_bus_id_returns_404():
    payload = {
        "status": "Delayed",
        "delay_minutes": 10,
        "note": "Valid note for nonexistent bus",
        "updated_by": "Desk Officer"
    }
    response = client.post("/api/buses/9999/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 404
    assert response.json()["detail"] == "Bus not found"


# --- Transparent Correction Workflow Tests ---

def test_transparent_correction_workflow():
    # 1. Post initial erroneous report
    initial_payload = {
        "status": "Delayed",
        "delay_minutes": 45,
        "note": "Severe accident on highway reported.",
        "updated_by": "Operator 1"
    }
    res1 = client.post("/api/buses/2/updates", json=initial_payload, headers=AUTH_HEADERS)
    assert res1.status_code == 201
    initial_id = res1.json()["id"]

    # 2. Publish a correction referencing initial update
    correction_payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Accident cleared to shoulder. Delay reduced to 15m.",
        "updated_by": "Operator 2",
        "is_correction": True,
        "supersedes_update_id": initial_id,
        "correction_reason": "Adjusted delay estimate after highway patrol clearance."
    }
    res2 = client.post("/api/buses/2/updates", json=correction_payload, headers=AUTH_HEADERS)
    assert res2.status_code == 201
    corr_data = res2.json()
    assert corr_data["is_correction"] is True
    assert corr_data["supersedes_update_id"] == initial_id
    assert corr_data["correction_reason"] == correction_payload["correction_reason"]

    # 3. Verify history preserves BOTH the original and the correction
    bus_res = client.get("/api/buses/2")
    assert bus_res.status_code == 200
    updates = bus_res.json()["updates"]
    update_ids = [u["id"] for u in updates]
    assert initial_id in update_ids
    assert corr_data["id"] in update_ids

    # 4. Verify effective bus snapshot reflects the correction
    assert bus_res.json()["delay_minutes"] == 15
    assert bus_res.json()["current_note"] == correction_payload["note"]


def test_correction_validation_missing_supersedes_id():
    payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Attempted correction without supersedes ID.",
        "updated_by": "Operator",
        "is_correction": True,
        "supersedes_update_id": None,
        "correction_reason": "Some reason"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422


def test_correction_validation_missing_reason():
    payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Attempted correction without reason.",
        "updated_by": "Operator",
        "is_correction": True,
        "supersedes_update_id": 1,
        "correction_reason": ""  # Invalid empty reason
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422


def test_correction_target_not_found():
    payload = {
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Correction pointing to nonexistent update.",
        "updated_by": "Operator",
        "is_correction": True,
        "supersedes_update_id": 99999,
        "correction_reason": "Correcting phantom update"
    }
    response = client.post("/api/buses/1/updates", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 400
    assert "does not exist for bus" in response.json()["detail"]


# --- Freshness & Boundary Calculation Tests ---

def test_freshness_boundary_fresh():
    now = datetime.now(timezone.utc)
    # 5 minutes old
    t5 = (now - timedelta(minutes=5)).isoformat()
    res = calculate_freshness(t5, ref_time=now)
    assert res["freshness"] == "fresh"
    assert res["is_stale"] is False
    assert res["age_minutes"] == 5

    # Exact threshold: 15 minutes
    t15 = (now - timedelta(minutes=15)).isoformat()
    res15 = calculate_freshness(t15, ref_time=now)
    assert res15["freshness"] == "fresh"
    assert res15["is_stale"] is False


def test_freshness_boundary_aging():
    now = datetime.now(timezone.utc)
    # 16 minutes old (transition from fresh to aging)
    t16 = (now - timedelta(minutes=16)).isoformat()
    res16 = calculate_freshness(t16, ref_time=now)
    assert res16["freshness"] == "aging"
    assert res16["is_stale"] is False

    # 60 minutes old (upper bound of aging)
    t60 = (now - timedelta(minutes=60)).isoformat()
    res60 = calculate_freshness(t60, ref_time=now)
    assert res60["freshness"] == "aging"
    assert res60["is_stale"] is False


def test_freshness_boundary_stale():
    now = datetime.now(timezone.utc)
    # 61 minutes old (stale)
    t61 = (now - timedelta(minutes=61)).isoformat()
    res61 = calculate_freshness(t61, ref_time=now)
    assert res61["freshness"] == "stale"
    assert res61["is_stale"] is True

    # 4 hours old
    t4h = (now - timedelta(hours=4)).isoformat()
    res4h = calculate_freshness(t4h, ref_time=now)
    assert res4h["freshness"] == "stale"
    assert res4h["is_stale"] is True
    assert "Stale" in res4h["freshness_label"]


def test_freshness_future_timestamp_clock_skew():
    now = datetime.now(timezone.utc)
    # 2 minutes in future
    tfuture = (now + timedelta(minutes=2)).isoformat()
    res = calculate_freshness(tfuture, ref_time=now)
    assert res["freshness"] == "future"
    assert "future" in res["freshness_label"]


# --- ETA Calculation & Unknown ETA Tests ---

def test_eta_on_time():
    res = calculate_eta("08:15", "On time", 0, is_stale=False)
    assert res["estimated_arrival"] == "08:15"
    assert res["eta_type"] == "on_time"


def test_eta_delayed_with_minutes():
    # 08:30 + 15m delay -> 08:45
    res = calculate_eta("08:30", "Delayed", 15, is_stale=False)
    assert res["estimated_arrival"] == "08:45"
    assert res["eta_type"] == "estimated"
    assert "Est. 08:45" in res["eta_display"]


def test_eta_breakdown_unknown_eta():
    res = calculate_eta("08:30", "Breakdown", 0, is_stale=False)
    assert res["estimated_arrival"] is None
    assert res["eta_type"] == "unknown"
    assert "ETA Unknown" in res["eta_display"]


def test_eta_service_cancelled():
    res = calculate_eta("08:30", "Service cancelled", 0, is_stale=False)
    assert res["estimated_arrival"] is None
    assert res["eta_type"] == "cancelled"
    assert res["eta_display"] == "Service Cancelled"


def test_eta_stale_flagged_in_display():
    res = calculate_eta("08:30", "Delayed", 15, is_stale=True)
    assert "[Stale report]" in res["eta_display"]


# --- Database Persistence Verification ---

def test_persistence_across_connection_reopen():
    payload = {
        "status": "Breakdown",
        "delay_minutes": 0,
        "note": "Engine breakdown near Sports Complex.",
        "updated_by": "Mechanical Desk"
    }
    res = client.post("/api/buses/3/updates", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 201

    # Verify directly using a fresh database connection
    with connect() as fresh_db:
        row = fresh_db.execute("SELECT status, current_note FROM buses WHERE id=3").fetchone()
        assert row["status"] == "Breakdown"
        assert row["current_note"] == payload["note"]
