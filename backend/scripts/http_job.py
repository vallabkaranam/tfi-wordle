import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    job_kind = os.getenv("JOB_KIND", "health")
    backend_url = os.getenv("BACKEND_BASE_URL")

    if not backend_url:
        print("BACKEND_BASE_URL is required", file=sys.stderr)
        return 1

    if job_kind == "refresh":
        target_url = f"{backend_url.rstrip('/')}/api/admin/refresh-cache"
        request = urllib.request.Request(target_url, method="POST")
        token = os.getenv("REFRESH_JOB_TOKEN")
        if token:
            request.add_header("x-refresh-token", token)
    else:
        target_url = f"{backend_url.rstrip('/')}/api/health"
        request = urllib.request.Request(target_url, method="GET")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
            try:
                print(json.dumps(json.loads(payload), indent=2))
            except json.JSONDecodeError:
                print(payload)
    except urllib.error.HTTPError as exc:
        print(f"{job_kind} job failed with status {exc.code}", file=sys.stderr)
        print(exc.read().decode("utf-8"), file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"{job_kind} job failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
