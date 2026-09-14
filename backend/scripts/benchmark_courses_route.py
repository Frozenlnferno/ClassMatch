#!/usr/bin/env python3
import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed


DEFAULT_PAYLOAD = {
    "courses": [
        {"subject": "CS", "course": "374", "crn": "65088"},
        {"subject": "MATH", "course": "441", "crn": "61553"},
        {"subject": "CS", "course": "222", "crn": "71617"},
        {"subject": "MATH", "course": "257", "crn": "71669"},
    ]
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Benchmark POST /api/schedules/courses throughput and latency."
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("BENCH_BASE_URL", "http://localhost:5000"),
        help="Backend base URL. Default: %(default)s",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("BENCH_ACCESS_TOKEN"),
        help="Bearer token. Can also be set with BENCH_ACCESS_TOKEN.",
    )
    parser.add_argument(
        "--term",
        default=os.getenv("BENCH_TERM", "spring"),
        help="Schedule term query parameter. Default: %(default)s",
    )
    parser.add_argument(
        "--year",
        default=os.getenv("BENCH_YEAR", "2026"),
        help="Schedule year query parameter. Default: %(default)s",
    )
    parser.add_argument(
        "--total",
        type=int,
        default=int(os.getenv("BENCH_TOTAL_REQUESTS", "100")),
        help="Total number of requests to send. Default: %(default)s",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=int(os.getenv("BENCH_CONCURRENCY", "10")),
        help="Number of concurrent in-flight requests. Default: %(default)s",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.getenv("BENCH_TIMEOUT_SECONDS", "60")),
        help="Per-request timeout in seconds. Default: %(default)s",
    )
    parser.add_argument(
        "--payload-file",
        help="Optional path to a JSON file used as the request body.",
    )
    return parser.parse_args()


def load_payload(payload_file):
    if not payload_file:
        return DEFAULT_PAYLOAD

    with open(payload_file, "r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def build_request(url, token, payload):
    encoded_payload = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return urllib.request.Request(url, data=encoded_payload, headers=headers, method="POST")


def send_request(url, token, payload, timeout):
    started_at = time.perf_counter()
    request = build_request(url, token, payload)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            latency = time.perf_counter() - started_at
            return {
                "ok": 200 <= response.status < 300,
                "status_code": response.status,
                "latency": latency,
                "body": body[:300],
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        latency = time.perf_counter() - started_at
        return {
            "ok": False,
            "status_code": exc.code,
            "latency": latency,
            "body": body[:300],
        }
    except Exception as exc:
        latency = time.perf_counter() - started_at
        return {
            "ok": False,
            "status_code": "EXC",
            "latency": latency,
            "body": str(exc),
        }


def percentile(values, pct):
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]

    sorted_values = sorted(values)
    index = (len(sorted_values) - 1) * pct
    lower = int(index)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = index - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction


def main():
    args = parse_args()

    if not args.token:
        print("Missing bearer token. Pass --token or set BENCH_ACCESS_TOKEN.", file=sys.stderr)
        return 1
    if args.total <= 0:
        print("--total must be greater than zero.", file=sys.stderr)
        return 1
    if args.concurrency <= 0:
        print("--concurrency must be greater than zero.", file=sys.stderr)
        return 1

    payload = load_payload(args.payload_file)
    url = f"{args.base_url.rstrip('/')}/api/schedules/courses?term={args.term}&year={args.year}"

    print(f"URL:         {url}")
    print(f"Total:       {args.total}")
    print(f"Concurrency: {args.concurrency}")
    print(f"Timeout:     {args.timeout}s")
    print("Starting benchmark...")

    results = []
    started_at = time.perf_counter()

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = [
            executor.submit(send_request, url, args.token, payload, args.timeout)
            for _ in range(args.total)
        ]
        for future in as_completed(futures):
            results.append(future.result())

    elapsed = time.perf_counter() - started_at
    latencies = [result["latency"] for result in results]
    status_counts = Counter(result["status_code"] for result in results)
    failures = [result for result in results if not result["ok"]]

    print()
    print(f"Elapsed:      {elapsed:.2f}s")
    print(f"Requests/sec: {args.total / elapsed:.2f}")
    print(f"Mean latency: {statistics.mean(latencies):.3f}s")
    print(f"Median:       {statistics.median(latencies):.3f}s")
    print(f"P95:          {percentile(latencies, 0.95):.3f}s")
    print(f"P99:          {percentile(latencies, 0.99):.3f}s")
    print(f"Status codes: {dict(status_counts)}")
    print(f"Failures:     {len(failures)}")

    if failures:
        print()
        print("Sample failures:")
        for failure in failures[:5]:
            print(f"- [{failure['status_code']}] {failure['body']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
