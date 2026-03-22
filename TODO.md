# KrishiSarth — TODO & Milestone Tracker

Last updated: March 2026

---

## Current milestone: MVP (v0.1.0)

Target: Working demo with 1 farm, 6 zones, live dashboard, AI decisions

---

## Status legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

---

## Milestone 0 — Project setup ✅

- [x] Create monorepo structure (backend / frontend / firmware)
- [x] docker-compose.yml with PostgreSQL, InfluxDB, Redis, Mosquitto
- [x] .env.example with all required variables documented
- [x] Makefile with dev / test / migrate / deploy shortcuts
- [x] GitHub Actions CI pipeline (lint + pytest on PR)
- [x] README.md, PROJECT_SPEC.md, TODO.md authored

---

## Milestone 1 — Backend core

### Auth
- [x] POST /auth/register — bcrypt hash, JWT sign
- [x] POST /auth/login — verify password, issue access + refresh tokens
- [x] POST /auth/refresh — jti rotation + Redis revocation
- [x] JWT auth middleware (get_current_farmer dependency)
- [x] Ownership middleware (verify_farm_owner, verify_zone_owner)
- [x] Rate limiter middleware (100 req/min per token, Redis counter)
- [x] Logging middleware (request_id injection, structured JSON logs)
- [ ] Brute force protection (5 failed logins → 15 min lockout)
- [ ] Device key provisioning endpoint (admin only)

### Farms & zones
- [x] GET/POST /farms
- [x] GET /farms/:id (with zone list + alert count)
- [x] POST /farms/:id/zones
- [x] PATCH /zones/:id (crop stage, is_active)
- [ ] DELETE support (soft-delete via is_active=false only)

### Dashboard
- [ ] GET /farms/:id/dashboard — aggregate from InfluxDB + Redis cache
- [ ] WebSocket endpoint — push updates every 15s

### Control
- [ ] POST /zones/:id/irrigate — Redis lock + Celery task enqueue
- [ ] POST /zones/:id/stop — revoke Celery task + stop command via MQTT
- [ ] POST /zones/:id/fertigation — pre-condition pump check

### Alerts
- [ ] GET /farms/:id/alerts (filter by severity, is_read)
- [ ] PATCH /alerts/:id/read

### Analytics
- [ ] GET /farms/:id/analytics (Flux query → aggregate)
- [ ] GET /farms/:id/analytics/export (CSV streaming response)

---

## Milestone 2 — IoT pipeline

### MQTT / ingestion
- [ ] Mosquitto broker setup in docker-compose
- [ ] Paho MQTT client subscriber (app/mqtt/client.py)
- [ ] Sensor payload parser (line protocol → InfluxDB write)
- [ ] Field validation: moisture 0–100%, temp -10–60°C, EC 0–10 dS/m, pH 0–14
- [ ] Dead-letter queue for failed InfluxDB writes (Redis List + Celery retry)

### Celery workers
- [ ] celery_app.py setup with Redis broker
- [ ] irrigation_worker.py — pump on/off MQTT command + ACK wait (10s timeout)
- [ ] ai_worker.py — scheduled every 15 min via Celery Beat
- [ ] alert_worker.py — threshold checks + notification dispatch
- [ ] Watchdog task — detect orphaned running schedules > duration + 10 min

### Device auth
- [ ] X-Device-Key header middleware
- [ ] Key hash verification against devices table
- [ ] Auto-mark device is_online=true on first successful auth

---

## Milestone 3 — AI / ML engine

- [ ] Feature engineering pipeline (InfluxDB → Pandas DataFrame)
- [ ] LSTM model training script (train_lstm.py)
- [ ] Random Forest training script (train_rf.py)
- [ ] Model evaluation report (precision / recall / accuracy)
- [ ] Model loading in ai_service.py with SHA-256 checksum verification
- [ ] S3 model upload/download helpers
- [ ] OpenWeather API client with 6h Redis cache
- [ ] Decision confidence thresholds (≥0.80 auto-execute, 0.60–0.79 flag, <0.60 informational)
- [ ] Four-level fallback chain (LSTM+weather → LSTM only → rule-based → time schedule)
- [ ] POST /zones/:id/ai-decisions/run — on-demand inference endpoint
- [ ] Crop stage anomaly detection (alert if stage duration inconsistent with zone age)

---

## Milestone 4 — Frontend

- [x] Responsive single-page app shell (HTML + Tailwind + DM Sans)
- [x] Sticky navbar with mobile hamburger drawer
- [x] Dashboard page — sensor cards, tank ring, soil depth, water quality
- [x] AI Decisions page — terminal panel + decision cards + confidence
- [x] Control Panel — zone toggles, duration picker, fertigation slider
- [x] Analytics page — SVG charts + fertigation log table
- [ ] api/client.js — fetch wrapper with JWT header + silent refresh on 401
- [ ] state/store.js — minimal pub/sub store
- [ ] WebSocket client with exponential backoff reconnect
- [ ] localStorage dashboard cache fallback (stale data on network loss)
- [ ] Login page (form → POST /auth/login → store tokens)
- [ ] Registration page
- [ ] Toast notification system (success / error / warning)
- [ ] Multilingual support (English, Hindi, Marathi) via i18n JSON files
- [ ] PWA manifest + service worker (offline caching)

---

## Milestone 5 — Firmware

- [ ] PlatformIO project setup (platformio.ini)
- [ ] Sensor drivers: soil_moisture, dht22, ec_sensor, ph_sensor, ldr
- [ ] LoRa radio driver (SX1278 — comms/lora_radio.cpp)
- [ ] WiFi manager with reconnect on drop
- [ ] MQTT publish to cloud broker
- [ ] Deep sleep cycle (wake every 15 min, sample, transmit)
- [ ] Hardware watchdog (reboot on 8s hang)
- [ ] OTA firmware update from S3 URL
- [ ] Calibration values from SPIFFS /data/calibration.json
- [ ] Pi gateway: Mosquitto local broker + cloud MQTT bridge
- [ ] Pi relay controller: on/off + safety timer cutoff
- [ ] Pi local SQLite buffer (24h offline storage + replay on reconnect)

---

## Milestone 6 — Database migrations & data

- [ ] Alembic init + alembic.ini setup
- [ ] 001_init_farmers_farms_zones.py
- [ ] 002_add_devices.py
- [ ] 003_add_irrigation_schedules.py
- [ ] 004_add_ai_decisions.py
- [ ] 005_add_fertigation_logs.py
- [ ] 006_add_alerts.py
- [ ] Seed script: demo farmer + 1 farm + 6 zones (for local dev)
- [ ] InfluxDB bucket + retention policy setup script
- [ ] InfluxDB downsampling Flux tasks (7d → 1h, 30d → 1d)

---

## Milestone 7 — Testing

- [ ] Unit: test_ai_service.py (mock model, test decision thresholds)
- [ ] Unit: test_auth.py (JWT sign/verify, bcrypt, token rotation)
- [ ] Unit: test_sensor_validation.py (out-of-range rejection)
- [ ] Integration: test_farms_api.py (full HTTP round-trip)
- [ ] Integration: test_control_api.py (irrigate, stop, conflict cases)
- [ ] Integration: test_refresh_token_rotation.py (replay attack)
- [ ] Firmware unit: test_sensors.cpp (mock ADC, verify conversions)
- [ ] Firmware unit: test_mqtt_payload.cpp (line protocol format)
- [ ] Load test: 1,000 concurrent WebSocket connections (k6)
- [ ] Security: OWASP top 10 review checklist

---

## Milestone 8 — Deployment & DevOps

- [ ] render.yaml (FastAPI + Celery + MQTT subscriber + managed DB)
- [ ] Dockerfile for FastAPI service
- [ ] Dockerfile for Celery worker
- [ ] GitHub Actions: deploy.yml (push to Render on merge to main)
- [ ] GitHub Actions: ci.yml (pytest + eslint on PR)
- [ ] Health check endpoint: GET /health (DB + Redis + InfluxDB ping)
- [ ] Rollback script: alembic downgrade -1
- [ ] Secrets management: Render environment variables (not .env in repo)
- [ ] Cloudflare for frontend CDN + DDoS protection
- [ ] Uptime monitoring (Better Uptime or UptimeRobot)
- [ ] Error tracking (Sentry — backend + frontend)
- [ ] Log aggregation (Papertrail or Datadog)

---

## Backlog (post-MVP)

### v0.2.0 — Enhanced AI
- [ ] Model retraining pipeline: Celery Beat weekly job → fetch new InfluxDB data → retrain → upload to S3 → reload worker
- [ ] Per-crop-type model variants (tomato, wheat, sugarcane, mango)
- [ ] Nutrient leaching detection (deep layer moisture spike after fertigation)
- [ ] Water usage prediction for next 7 days

### v0.3.0 — Farm management
- [ ] Zone heatmap (grid visualization of moisture across zones)
- [ ] Multiple farms per farmer dashboard (farm switcher)
- [ ] Farm sharing (invite co-farmer with read or write access)
- [ ] Irrigation history timeline with water usage per event

### v0.4.0 — Integrations
- [ ] India Meteorological Department (IMD) API as weather source alternative
- [ ] WhatsApp notifications (Twilio for Business API)
- [ ] SMS alerts in regional languages
- [ ] Export data to Kisan Suvidha portal format

### v1.0.0 — Scale
- [ ] Migrate to AWS (EC2 + RDS + ElastiCache + S3)
- [ ] Multi-tenant isolation review (row-level security on PostgreSQL)
- [ ] Horizontal Celery worker scaling (AWS Auto Scaling)
- [ ] 10,000 farmer load test
- [ ] SOC 2 Type I audit prep
- [ ] Android native app (React Native from shared component library)

---

## Known issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | WebSocket reconnect loop fires too fast on server restart | Medium | [ ] Open |
| 2 | InfluxDB write retries not capped at 24h payload age | Medium | [ ] Open |
| 3 | Crop stage anomaly detection has no tunable per-crop thresholds | Low | [ ] Open |
| 4 | Analytics CSV export holds full result in memory (no streaming) | Low | [ ] Open |

---

*KrishiSarth TODO — updated as milestones progress (2026)*
