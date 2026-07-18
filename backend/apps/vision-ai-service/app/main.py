from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="PSSMS Vision AI Service", version="0.1.0")


class AnprRecognizeRequest(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    camera_id: Optional[str] = None
    site_id: Optional[str] = None
    plate_hint: Optional[str] = None
    captured_at: Optional[str] = None


class AnprRecognizeResponse(BaseModel):
    plate_number: str
    confidence: float
    camera_id: Optional[str] = None
    snapshot_url: Optional[str] = None


class CctvEventRequest(BaseModel):
    camera_id: str
    site_id: str
    event_type: str
    detected_at: str
    confidence: float = Field(ge=0, le=1)
    snapshot_url: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "vision-ai-service"}


@app.post("/v1/anpr/recognize", response_model=AnprRecognizeResponse)
def recognize(req: AnprRecognizeRequest):
    if req.plate_hint:
        plate = req.plate_hint.upper()
        confidence = 0.88
    elif req.camera_id == "demo-cam-01":
        plate = "T123ABC"
        confidence = 0.92
    elif req.image_url and "T123" in req.image_url.upper():
        plate = "T123ABC"
        confidence = 0.9
    else:
        plate = "UNKNOWN"
        confidence = 0.15

    return AnprRecognizeResponse(
        plate_number=plate,
        confidence=confidence,
        camera_id=req.camera_id,
        snapshot_url=req.image_url,
    )


@app.post("/v1/cctv/events")
def cctv_event(req: CctvEventRequest):
    return {
        "event_id": f"cctv-{req.camera_id}-{datetime.now(timezone.utc).isoformat()}",
        "accepted": True,
        "event_type": req.event_type,
        "site_id": req.site_id,
    }
