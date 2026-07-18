import asyncio
import time
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Check OpenAPI metadata
        r = await client.get("http://localhost:8000/openapi.json")
        data = r.json()
        assert data["info"]["title"] == "LexIO Regulatory Compiler API"
        assert data["info"]["version"] == "1.0.0"
        
        # Batch Latency Test
        times = []
        payload = {
            "amount": 500,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False
        }
        for _ in range(10):
            start = time.perf_counter()
            r = await client.post("http://localhost:8000/api/v1/compliance/check", json=payload)
            r.raise_for_status()
            times.append((time.perf_counter() - start) * 1000)
        
        avg = sum(times) / len(times)
        print(f"OpenAPI Verified. Latency over 10 requests: {avg:.2f}ms")

asyncio.run(main())
