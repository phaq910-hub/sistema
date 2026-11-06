"""Geocoding (Nominatim) + road routing (OSRM) with a straight-line fallback. All free/public services."""

import logging
import math

import httpx

logger = logging.getLogger(__name__)
UA = {"User-Agent": "TechlineConsultoria/1.0 (service-orders)"}
URBAN_KMH = 30.0  # fallback average speed in the city


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def geocode(address: str) -> dict | None:
    if not address.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=8, headers=UA) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": address, "format": "json", "limit": 1, "countrycodes": "br"},
            )
            data = res.json() if res.status_code == 200 else []
            if data:
                return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as exc:
        logger.warning("geocode failed: %s", exc)
    return None


async def road_route(lat1: float, lng1: float, lat2: float, lng2: float) -> tuple[float, float] | None:
    """(distance_km, duration_min) by car via OSRM, or None."""
    url = f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}"
    try:
        async with httpx.AsyncClient(timeout=6, headers=UA) as client:
            res = await client.get(url, params={"overview": "false"})
            data = res.json() if res.status_code == 200 else {}
            if data.get("code") == "Ok" and data.get("routes"):
                r = data["routes"][0]
                return r["distance"] / 1000, r["duration"] / 60
    except Exception as exc:
        logger.warning("route failed: %s", exc)
    return None


def straight_estimate(lat1: float, lng1: float, lat2: float, lng2: float) -> tuple[float, float]:
    km = haversine_km(lat1, lng1, lat2, lng2) * 1.3  # streets are never straight
    return km, km / URBAN_KMH * 60
