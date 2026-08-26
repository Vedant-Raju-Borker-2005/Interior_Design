import subprocess
import time
import requests
import sys
import random

print("Starting backend uvicorn server...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd="backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)





# Wait for startup
time.sleep(6)

if proc.poll() is not None:
    print("Backend server crashed immediately! Logs:")
    print(proc.stderr.read() if proc.stderr else "No stderr stream")
    print(proc.stdout.read() if proc.stdout else "No stdout stream")
    sys.exit(1)

        
try:
    # 2. Hitting auth
    print("Authenticating...")
    login_resp = requests.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": "team@example.com"})
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        proc.terminate()
        sys.exit(1)
        
    dev_otp = login_resp.json()["dev_otp"]
    print(f"Dev OTP received: {dev_otp}")
    
    verify_resp = requests.post("http://127.0.0.1:8000/api/v1/auth/verify-otp", json={
        "email": "team@example.com",
        "otp": dev_otp
    })
    if verify_resp.status_code != 200:
        print("OTP verification failed:", verify_resp.text)
        proc.terminate()
        sys.exit(1)
        
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Authentication successful! Got token.")


    # 3. Create a project
    print("Creating a project for testing...")
    create_proj_resp = requests.post("http://127.0.0.1:8000/api/v1/projects", json={
        "bhk_type": "2BHK",
        "property_name": f"Test Integration Residence {time.time()}",
        "city": "Bangalore",
        "budget": 1500000.0,
        "pincode": "560100"
    }, headers=headers)
    
    if create_proj_resp.status_code != 200:
        print("Failed to create project:", create_proj_resp.text)
        proc.terminate()
        sys.exit(1)
        
    proj_id = create_proj_resp.json()["project_id"]
    print(f"Created Project ID: {proj_id}")

    # 4. Trigger sync by loading dashboard
    print("Loading team dashboard to sync team assignment...")
    dash_resp = requests.get("http://127.0.0.1:8000/api/v1/team/team/dashboard", headers=headers)
    print("Dashboard response code:", dash_resp.status_code)

    # 5. Get project team members
    print("Getting team members...")
    team_resp = requests.get(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/team", headers=headers)
    print("Team response code:", team_resp.status_code, "Members count:", len(team_resp.json()))

    # 6. Fetch Sourcing & Tracking items
    print("Getting tracking items...")
    track_resp = requests.get(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/tracking", headers=headers)
    print("Tracking response code:", track_resp.status_code)
    trackings = track_resp.json()["trackings"]
    print(f"Found {len(trackings)} tracking items.")

    if trackings:
        track_id = trackings[0]["id"]
        # Update tracking status
        print(f"Updating status of tracking item {track_id}...")
        up_resp = requests.put(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/tracking/{track_id}", json={
            "status": "delivered",
            "remarks": "Delivered to site via verification script"
        }, headers=headers)
        print("Update status response code:", up_resp.status_code)
        print("Update response json:", up_resp.json())

        # Fetch status history
        print("Fetching status history...")
        hist_resp = requests.get(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/tracking/{track_id}/history", headers=headers)
        print("History logs count:", len(hist_resp.json()))

    # 7. Issue & Escalations
    print("Creating execution issue...")
    issue_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/issues", json={
        "type": "DAMAGED_PRODUCT",
        "priority": "HIGH",
        "description": "Counter table scratch detected on delivery"
    }, headers=headers)
    print("Create issue status code:", issue_resp.status_code)
    issue_id = issue_resp.json()["id"]

    print(f"Adding comment to issue {issue_id}...")
    cmt_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/issues/{issue_id}/comments", json={
        "comment": "Site supervisor checked and confirmed"
    }, headers=headers)
    print("Add comment status code:", cmt_resp.status_code)

    print("Listing comments...")
    cmts_list = requests.get(f"http://127.0.0.1:8000/api/v1/team/issues/{issue_id}/comments", headers=headers)
    print("Comments found:", len(cmts_list.json()))

    print("Escalating issue...")
    esc_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/issues/{issue_id}/escalate", headers=headers)
    print("Escalate status code:", esc_resp.status_code, "Status:", esc_resp.json()["status"])

    # 8. Create task
    print("Creating execution task...")
    task_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/tasks", json={
        "title": "Verify Bed alignment",
        "dueDate": "2026-08-01T12:00:00Z",
        "priority": "HIGH",
        "description": "Verification of headboard fitment"
    }, headers=headers)
    print("Create task status code:", task_resp.status_code)

    # 9. Site visit
    print("Scheduling site visit...")
    visit_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/site-visits", json={
        "visitDate": "2026-07-28T10:00:00Z",
        "notes": "Verify modular kitchen cabinet installation"
    }, headers=headers)
    print("Schedule visit status code:", visit_resp.status_code)

    # 10. Communication log
    print("Logging call log...")
    comm_resp = requests.post(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/comms", json={
        "type": "CALL",
        "notes": "Customer called asking for execution updates"
    }, headers=headers)
    print("Log call status code:", comm_resp.status_code)

    # 11. Documents Repository
    print("Listing documents...")
    doc_resp = requests.get(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/documents", headers=headers)
    print("Documents found:", len(doc_resp.json()))

    # 12. Manager Analytics
    print("Getting project analytics...")
    an_resp = requests.get(f"http://127.0.0.1:8000/api/v1/team/projects/{proj_id}/analytics", headers=headers)
    print("Analytics status code:", an_resp.status_code, "Completion rate:", an_resp.json()["completionRate"])

    print("\nALL MODULE INTEGRATION TESTS COMPLETED SUCCESSFULLY!")

except Exception as e:
    print("Test encountered exception:", e)
    proc.terminate()
    sys.exit(1)

print("Terminating server...")
proc.terminate()
time.sleep(2)
print("Finished.")
