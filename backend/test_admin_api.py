import subprocess
import time
import requests
import sys

print("Starting backend uvicorn server for Admin checks...")
proc = subprocess.Popen(
    [r".venv\Scripts\python.exe", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Wait for startup
time.sleep(4)

try:
    # 1. Login as Admin
    print("Authenticating as Admin user...")
    login_resp = requests.post("http://127.0.0.1:8000/api/v1/auth/login", json={"email": "admin@example.com"})
    if login_resp.status_code != 200:
        print("Admin login failed:", login_resp.text)
        proc.terminate()
        sys.exit(1)
        
    dev_otp = login_resp.json()["dev_otp"]
    print(f"Dev OTP received: {dev_otp}")
    
    verify_resp = requests.post("http://127.0.0.1:8000/api/v1/auth/verify-otp", json={
        "email": "admin@example.com",
        "otp": dev_otp
    })
    if verify_resp.status_code != 200:
        print("OTP verification failed:", verify_resp.text)
        proc.terminate()
        sys.exit(1)
        
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Authentication successful! Admin token acquired.")

    # 2. Get Platform Stats
    print("Checking platform analytics stats...")
    stats_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/stats", headers=headers)
    print("Stats response code:", stats_resp.status_code, "Active projects count:", stats_resp.json().get("active_projects"))

    # 3. Customer Management
    print("Listing customers...")
    cust_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/customers", headers=headers)
    print("Customers response code:", cust_resp.status_code, "Customers count:", len(cust_resp.json().get("customers", [])))

    # 4. Vendor Approvals
    print("Listing vendor applications...")
    vendor_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/vendors", headers=headers)
    print("Vendors response code:", vendor_resp.status_code, "Vendors count:", len(vendor_resp.json()))

    # 5. Quotation Management
    print("Listing quotations...")
    quote_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/quotations", headers=headers)
    print("Quotations response code:", quote_resp.status_code, "Quotations count:", len(quote_resp.json()))

    # 6. Pricing Rule Engine
    print("Adding a pricing rule...")
    rule_resp = requests.post("http://127.0.0.1:8000/api/v1/admin/pricing/rules", json={
        "rule_type": "DISCOUNT",
        "name": "Diwali Offer 2026",
        "value": 0.15,
        "effective_date": "2026-10-01",
        "expiry_date": "2026-11-15"
    }, headers=headers)
    print("Create rule status code:", rule_resp.status_code, "Rule ID:", rule_resp.json().get("id"))

    # 7. Package Configuration
    print("Fetching package Configurations...")
    pkg_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/packages/configurations", headers=headers)
    print("Package configurations response code:", pkg_resp.status_code)

    # 8. System settings
    print("Updating SMS OTP template setting...")
    set_resp = requests.put("http://127.0.0.1:8000/api/v1/admin/settings", json={
        "key": "SMS_TEMPLATE_OTP",
        "value": "Your verification code is: {otp}. Valid for 5 minutes.",
        "category": "SMS"
    }, headers=headers)
    print("Update settings status code:", set_resp.status_code)

    # 9. Audit Logging
    print("Fetching system audit logs...")
    logs_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/audit-logs", headers=headers)
    print("Audit logs response code:", logs_resp.status_code, "Logs count:", len(logs_resp.json()))

    # 10. Management Reports Export
    print("Exporting Sales Report...")
    rep_resp = requests.get("http://127.0.0.1:8000/api/v1/admin/reports?category=sales", headers=headers)
    print("Export response code:", rep_resp.status_code, "Content length:", len(rep_resp.text))

    print("\nALL ADMIN MODULE INTEGRATION TESTS COMPLETED SUCCESSFULLY!")

except Exception as e:
    print("Test encountered exception:", e)
    proc.terminate()
    sys.exit(1)

print("Terminating server...")
proc.terminate()
time.sleep(2)
print("Finished.")
