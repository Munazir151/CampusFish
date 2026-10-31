"""Quick API smoke test. Run with: python scripts/smoke_test.py"""

import json
import sys

import httpx

BASE = "http://127.0.0.1:8000"


def show(label: str, value) -> None:
    print(f"{label}: {json.dumps(value, ensure_ascii=False, indent=2)}")


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=20)

    health = client.get("/api/health").json()
    assert health["ok"] is True
    print("health ok:", health)

    user = client.get("/api/users/me").json()
    print("user:", user["name"], user["branch"], user["semester"], user["scheme"])

    circulars = client.get("/api/circulars", params={"limit": 3}).json()
    print("circular count:", circulars["count"])
    for item in circulars["items"]:
        print(" title repr:", repr(item["title"])[:110])
        print("   category:", item["category"], "| urgency:", item["urgency"])

    filtered = client.get("/api/circulars", params={"category": "RESULT"}).json()
    print("RESULT filter:", filtered["count"], "items")
    assert all(i["category"] == "RESULT" for i in filtered["items"])

    # Source CRUD
    created = client.post(
        "/api/sources",
        json={
            "name": "Smoke test portal",
            "url": "https://example.edu/notices",
            "institution": "Example Institute",
        },
    ).json()
    print("source created:", created["id"])
    toggled = client.patch(f"/api/sources/{created['id']}", json={"enabled": False}).json()
    assert toggled["enabled"] == 0
    print("source toggled off ok")
    deleted = client.delete(f"/api/sources/{created['id']}").json()
    assert deleted["deleted"] is True
    print("source deleted ok")

    # Demo injection + dedupe
    injected = client.post("/api/demo/inject", json={}).json()
    duplicate = client.post("/api/demo/inject", json={}).json()
    print("inject alerts:", injected.get("alerts_created"), "| duplicate flagged:", duplicate.get("duplicate"))

    deadlines = client.get("/api/deadlines").json()
    print("deadlines:", deadlines["count"], [d["deadline"] for d in deadlines["items"]])

    alerts = client.get(f"/api/users/{user['id']}/alerts").json()
    print("alerts for user:", alerts["count"])

    scans = client.get("/api/scans").json()["items"]
    if scans:
        scan = scans[0]
        print("latest scan:", scan["status"], scan["new_items_count"], "new")
        for run in scan["runs"]:
            print("  -", run["source_name"], run["status"], "| tinyfish:", run["tinyfish_run_id"])
            if run["error"]:
                print("    error:", run["error"][:200])
    else:
        print("no scans yet")

    print("\nSMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
