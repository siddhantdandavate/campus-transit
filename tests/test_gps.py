from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from main import app, init_db, connect, STALE_GPS_THRESHOLD_SECONDS, DEMO_ADMIN_PASSWORD

client = TestClient(app)


def get_admin_headers():
    res = client.post("/api/auth/login", json={"username": "admin", "password": DEMO_ADMIN_PASSWORD})
    return {"Authorization": f"Bearer {res.json()['session_token']}"}


@pytest.fixture(autouse=True)
def setup_db():
    init_db()


def test_gps_empty_route_returns_unavailable():
    response = client.get("/api/buses/4/gps")
    assert response.status_code == 200
    data = response.json()
    assert data["bus_id"] == 4
    assert data["has_gps"] is False
    assert data["status"] == "unavailable"
    assert data["telemetry"] is None


def test_submit_valid_gps_observation():
    headers = get_admin_headers()
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    payload = {
        "latitude": 18.5204,
        "longitude": 73.8567,
        "accuracy_meters": 8.5,
        "speed_mps": 11.2,
        "heading_deg": 180.0,
        "device_timestamp": now_iso
    }
    response = client.post("/api/buses/1/gps", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["bus_id"] == 1
    assert data["latitude"] == 18.5204
    assert data["longitude"] == 73.8567
    assert data["accuracy_meters"] == 8.5
    assert "received_at" in data

    # Verify retrieval
    get_res = client.get("/api/buses/1/gps")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["has_gps"] is True
    assert get_data["status"] == "live"
    assert get_data["telemetry"]["latitude"] == 18.5204
    assert get_data["telemetry"]["is_stale"] is False


def test_submit_gps_invalid_coordinates():
    headers = get_admin_headers()
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Latitude out of bounds (> 90)
    res1 = client.post("/api/buses/1/gps", json={
        "latitude": 95.0,
        "longitude": 73.85,
        "accuracy_meters": 10.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert res1.status_code == 422

    # Longitude out of bounds (> 180)
    res2 = client.post("/api/buses/1/gps", json={
        "latitude": 18.5,
        "longitude": 185.0,
        "accuracy_meters": 10.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert res2.status_code == 422

    # Negative accuracy
    res3 = client.post("/api/buses/1/gps", json={
        "latitude": 18.5,
        "longitude": 73.85,
        "accuracy_meters": -5.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert res3.status_code == 422


def test_submit_gps_implausible_timestamp():
    headers = get_admin_headers()
    # Future timestamp > 120s
    future_time = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(timespec="seconds")
    res1 = client.post("/api/buses/1/gps", json={
        "latitude": 18.5,
        "longitude": 73.85,
        "accuracy_meters": 10.0,
        "device_timestamp": future_time
    }, headers=headers)
    assert res1.status_code == 422

    # Ancient timestamp > 24 hours
    ancient_time = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(timespec="seconds")
    res2 = client.post("/api/buses/1/gps", json={
        "latitude": 18.5,
        "longitude": 73.85,
        "accuracy_meters": 10.0,
        "device_timestamp": ancient_time
    }, headers=headers)
    assert res2.status_code == 422


def test_gps_out_of_order_rejection():
    headers = get_admin_headers()
    t_now = datetime.now(timezone.utc)
    t1 = (t_now - timedelta(seconds=10)).isoformat(timespec="seconds")
    t2 = (t_now - timedelta(seconds=30)).isoformat(timespec="seconds")  # Older than t1

    # Send newer observation first
    res1 = client.post("/api/buses/2/gps", json={
        "latitude": 18.50,
        "longitude": 73.80,
        "accuracy_meters": 5.0,
        "device_timestamp": t1
    }, headers=headers)
    assert res1.status_code == 201

    # Send older observation second -> Should be rejected with 409
    res2 = client.post("/api/buses/2/gps", json={
        "latitude": 18.49,
        "longitude": 73.79,
        "accuracy_meters": 6.0,
        "device_timestamp": t2
    }, headers=headers)
    assert res2.status_code == 409
    assert "Out-of-order" in res2.json()["detail"]


def test_gps_stale_detection():
    headers = get_admin_headers()
    # Submit observation with timestamp from 3 minutes ago (> STALE_GPS_THRESHOLD_SECONDS = 120s)
    stale_time = (datetime.now(timezone.utc) - timedelta(seconds=180)).isoformat(timespec="seconds")
    res = client.post("/api/buses/3/gps", json={
        "latitude": 18.60,
        "longitude": 73.90,
        "accuracy_meters": 12.0,
        "device_timestamp": stale_time
    }, headers=headers)
    assert res.status_code == 201

    # Query status -> Should detect stale
    get_res = client.get("/api/buses/3/gps")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["status"] == "stale"
    assert data["telemetry"]["is_stale"] is True
    assert "Stale coordinates" in data["message"]


def test_gps_unknown_bus_id_returns_404():
    headers = get_admin_headers()
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    res = client.post("/api/buses/9999/gps", json={
        "latitude": 18.5,
        "longitude": 73.85,
        "accuracy_meters": 10.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert res.status_code == 404
