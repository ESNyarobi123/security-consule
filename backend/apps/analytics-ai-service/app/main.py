from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="PSSMS Analytics AI Service", version="0.1.0")


class HistoryPoint(BaseModel):
    period: str
    net_pay_total: float


class ForecastRequest(BaseModel):
    organization_id: str
    history: list[HistoryPoint] = Field(default_factory=list)
    horizon_months: int = 3


class SeriesPoint(BaseModel):
    t: str
    value: float


class AnomalyRequest(BaseModel):
    organization_id: str
    domain: str = "ATTENDANCE"
    points: list[SeriesPoint] = Field(default_factory=list)
    threshold: float = 2.0


@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-ai-service"}


@app.post("/v1/forecast/payroll")
def forecast_payroll(req: ForecastRequest):
    last = req.history[-1].net_pay_total if req.history else 0.0
    series = []
    for i in range(1, max(1, req.horizon_months) + 1):
        series.append(
            {
                "period": f"M+{i}",
                "predicted_net_pay": round(last * (1.02**i), 2),
            }
        )
    return {
        "series": series,
        "model": "stub-linear",
        "confidence": 0.72 if req.history else 0.4,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "history_points": len(req.history),
    }


@app.post("/v1/anomalies/detect")
def detect_anomalies(req: AnomalyRequest):
    values = [p.value for p in req.points]
    anomalies = []
    if len(values) >= 3:
        mu = mean(values)
        sigma = pstdev(values) or 1.0
        for p in req.points:
            z = (p.value - mu) / sigma
            if abs(z) > req.threshold:
                anomalies.append(
                    {
                        "t": p.t,
                        "value": p.value,
                        "score": round(abs(z), 4),
                        "reason": f"|z|={abs(z):.2f} > {req.threshold}",
                    }
                )
    return {
        "anomalies": anomalies,
        "model": "stub-zscore",
        "domain": req.domain,
        "points_analyzed": len(req.points),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
