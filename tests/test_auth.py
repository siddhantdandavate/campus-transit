from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from main import (
    app,
    init_db,
    connect,
    DEMO_ADMIN_PASSWORD,
    DEMO_OPERATOR_PASSWORD,
    DEMO_DRIVER_PASSWORD,
    LOGIN_ATTEMPTS
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    LOGIN_ATTEMPTS.clear()


def test_login_success_admin():
    res = client.post("/api/auth/login", json={"username": "admin", "password": DEMO_ADMIN_PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "session_token" in data
    assert "csrf_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"
    # Check cookies are set
    cookies = res.cookies
    assert "campus_transit_session" in cookies
    assert "campus_transit_csrf" in cookies


def test_login_success_driver():
    res = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["username"] == "driver_ramesh"
    assert data["user"]["role"] == "driver"
    assert data["user"]["assigned_bus_id"] == 1


def test_login_invalid_password():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "WrongPassword!999"})
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]


def test_login_rate_limiting():
    # 5 failed attempts allowed, 6th should trigger 429
    for _ in range(5):
        res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert res.status_code == 401

    rate_res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert rate_res.status_code == 429
    assert "Too many failed login attempts" in rate_res.json()["detail"]


def test_get_current_session_authenticated():
    res = client.post("/api/auth/login", json={"username": "dispatcher", "password": DEMO_OPERATOR_PASSWORD})
    token = res.json()["session_token"]

    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["authenticated"] is True
    assert data["user"]["username"] == "dispatcher"
    assert data["user"]["role"] == "operator"


def test_get_current_session_invalid_token():
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token-12345"})
    assert res.status_code == 401


def test_logout_invalidates_session():
    res = client.post("/api/auth/login", json={"username": "admin", "password": DEMO_ADMIN_PASSWORD})
    token = res.json()["session_token"]

    # Verify active
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

    # Verify session is destroyed in DB
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_after.status_code == 401


def test_anonymous_write_rejection_updates():
    res = client.post("/api/buses/1/updates", json={
        "status": "Delayed",
        "delay_minutes": 15,
        "note": "Traffic jam near main gate"
    })
    assert res.status_code == 401


def test_anonymous_write_rejection_gps():
    res = client.post("/api/buses/1/gps", json={
        "latitude": 18.5204,
        "longitude": 73.8567,
        "accuracy_meters": 10.0,
        "device_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds")
    })
    assert res.status_code == 401


def test_driver_assigned_bus_update_success():
    res = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ramesh is assigned to Bus 1
    update_res = client.post("/api/buses/1/updates", json={
        "status": "Delayed",
        "delay_minutes": 10,
        "note": "Slow moving traffic along East Avenue"
    }, headers=headers)
    assert update_res.status_code == 201
    assert update_res.json()["bus_id"] == 1


def test_driver_unassigned_bus_update_rejected():
    res = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ramesh is assigned to Bus 1, attempting to update Bus 2
    update_res = client.post("/api/buses/2/updates", json={
        "status": "Delayed",
        "delay_minutes": 10,
        "note": "Attempting unauthorized update"
    }, headers=headers)
    assert update_res.status_code == 403
    assert "Driver permission denied" in update_res.json()["detail"]


def test_driver_cannot_issue_corrections():
    res = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    corr_res = client.post("/api/buses/1/updates", json={
        "status": "On time",
        "delay_minutes": 0,
        "note": "Correcting previous report",
        "is_correction": True,
        "supersedes_update_id": 1,
        "correction_reason": "False alarm reported earlier"
    }, headers=headers)
    assert corr_res.status_code == 403
    assert "drivers cannot issue historical corrections" in corr_res.json()["detail"]


def test_driver_assigned_gps_success_and_unassigned_rejected():
    res = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

    # Ramesh assigned to Bus 1 -> Allowed
    gps_res1 = client.post("/api/buses/1/gps", json={
        "latitude": 18.5204,
        "longitude": 73.8567,
        "accuracy_meters": 5.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert gps_res1.status_code == 201

    # Ramesh attempting to send GPS for Bus 2 -> Rejected (403)
    gps_res2 = client.post("/api/buses/2/gps", json={
        "latitude": 18.5204,
        "longitude": 73.8567,
        "accuracy_meters": 5.0,
        "device_timestamp": now_iso
    }, headers=headers)
    assert gps_res2.status_code == 403
    assert "Driver permission denied" in gps_res2.json()["detail"]


def test_operator_can_update_and_correct_any_bus():
    res = client.post("/api/auth/login", json={"username": "dispatcher", "password": DEMO_OPERATOR_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Operator publishes disruption on Bus 1
    post_res = client.post("/api/buses/1/updates", json={
        "status": "Breakdown",
        "delay_minutes": 45,
        "note": "Engine overheating near library",
        "updated_by": "Ops Control"
    }, headers=headers)
    assert post_res.status_code == 201
    prior_id = post_res.json()["id"]

    # Operator issues correction on Bus 1
    corr_res = client.post("/api/buses/1/updates", json={
        "status": "Delayed",
        "delay_minutes": 20,
        "note": "Coolant refilled, resuming slow transit",
        "updated_by": "Ops Control",
        "is_correction": True,
        "supersedes_update_id": prior_id,
        "correction_reason": "Maintenance crew cleared engine issue quicker than anticipated"
    }, headers=headers)
    assert corr_res.status_code == 201
    assert corr_res.json()["is_correction"] is True
    assert corr_res.json()["supersedes_update_id"] == prior_id

    # Verify history is preserved
    updates_res = client.get("/api/updates?bus_id=1")
    history = updates_res.json()
    assert len(history) >= 2
    corr_entry = next(u for u in history if u["id"] == corr_res.json()["id"])
    assert corr_entry["correction_reason"] == "Maintenance crew cleared engine issue quicker than anticipated"


def test_operator_and_driver_forbidden_on_admin_routes():
    # Driver rejected on /api/admin/users
    res_d = client.post("/api/auth/login", json={"username": "driver_ramesh", "password": DEMO_DRIVER_PASSWORD})
    token_d = res_d.json()["session_token"]
    admin_users_res1 = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token_d}"})
    assert admin_users_res1.status_code == 403

    # Operator rejected on /api/admin/users
    res_o = client.post("/api/auth/login", json={"username": "dispatcher", "password": DEMO_OPERATOR_PASSWORD})
    token_o = res_o.json()["session_token"]
    admin_users_res2 = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token_o}"})
    assert admin_users_res2.status_code == 403

    # Operator rejected on route creation /api/admin/buses
    create_res = client.post("/api/admin/buses", json={
        "bus_code": "ROUTE-99",
        "route_name": "Unauthorized Test Route",
        "origin": "Point A",
        "destination": "Point B",
        "scheduled_arrival": "17:00"
    }, headers={"Authorization": f"Bearer {token_o}"})
    assert create_res.status_code == 403


def test_admin_privileged_operations():
    res = client.post("/api/auth/login", json={"username": "admin", "password": DEMO_ADMIN_PASSWORD})
    token = res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Admin can list users
    users_res = client.get("/api/admin/users", headers=headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 4
    # Password hashes must never be exposed
    for u in users:
        assert "password_hash" not in u
        assert "password" not in u

    # Clean up any prior test route if present
    with connect() as db:
        db.execute("DELETE FROM buses WHERE bus_code = 'CAMPUS-EXPRESS'")

    # Admin can create route
    create_res = client.post("/api/admin/buses", json={
        "bus_code": "CAMPUS-EXPRESS",
        "route_name": "Express Connector",
        "origin": "Tech Park",
        "destination": "North Campus Terminal",
        "scheduled_arrival": "18:45"
    }, headers=headers)
    assert create_res.status_code == 201
    new_id = create_res.json()["id"]

    # Verify route is now public for riders
    buses_res = client.get(f"/api/buses/{new_id}")
    assert buses_res.status_code == 200
    assert buses_res.json()["bus_code"] == "CAMPUS-EXPRESS"
    assert buses_res.json()["status"] == "On time"


def test_csrf_protection_for_cookie_auth():
    # Login and obtain session cookie + csrf token
    login_res = client.post("/api/auth/login", json={"username": "dispatcher", "password": DEMO_OPERATOR_PASSWORD})
    session_cookie = login_res.cookies["campus_transit_session"]
    csrf_token = login_res.json()["csrf_token"]

    cookie_header = f"campus_transit_session={session_cookie}"

    # Write attempt without CSRF header should fail with 403
    fail_res = client.post(
        "/api/buses/1/updates",
        json={"status": "Delayed", "delay_minutes": 10, "note": "Testing CSRF failure"},
        headers={"Cookie": cookie_header}
    )
    assert fail_res.status_code == 403
    assert "CSRF validation failed" in fail_res.json()["detail"]

    # Write attempt with valid CSRF header should succeed with 201
    success_res = client.post(
        "/api/buses/1/updates",
        json={"status": "Delayed", "delay_minutes": 10, "note": "Testing CSRF success"},
        headers={"Cookie": cookie_header, "X-CSRF-Token": csrf_token}
    )
    assert success_res.status_code == 201
