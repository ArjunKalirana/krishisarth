# KrishiSarth — Project Rules for AI Coding Assistant

This file defines the rules, constraints, and conventions that any AI coding assistant **must follow** when implementing, modifying, or reviewing code in this project. Read this file before touching any code. These rules take precedence over general best practices when they conflict.

---

## 0. Read these files first — every session

Before writing any code, always read:

1. `PROJECT_SPEC.md` — architecture, data models, API contracts, ML thresholds
2. `TODO.md` — current milestone and task status (do not implement tasks marked `[!] Blocked`)
3. This file — PROJECT_RULES.md

If you are asked to implement a feature that contradicts `PROJECT_SPEC.md`, flag the conflict explicitly before proceeding. Do not silently deviate.

---

## 1. Project identity

- **Project name:** KrishiSarth (कृषिसार्थ)
- Never use the old name "AquaBrain" anywhere — not in comments, strings, log messages, config keys, variable names, or documentation
- The correct name in code is `krishisarth` (lowercase, no spaces) for package names, database names, S3 bucket names, and config keys
- Display name in UI strings: `KrishiSarth`
- API base URL: `https://api.krishisarth.in/v1`
- InfluxDB bucket name: `krishisarth_sensors`

---

## 2. Language and runtime versions

| Layer | Language / Runtime | Version |
|-------|--------------------|---------|
| Backend | Python | 3.11 exactly — do not use 3.12+ syntax |
| Backend framework | FastAPI | Latest stable |
| Frontend | Vanilla JavaScript | ES2022 (no TypeScript unless explicitly asked) |
| Frontend styling | Tailwind CSS | CDN build (no Tailwind compiler) |
| Firmware | C++ | Arduino framework via PlatformIO |
| Node (scripts only) | Node.js | 20+ |
| Database | PostgreSQL | 15 |
| Cache / Queue | Redis | 7 |
| Time-series DB | InfluxDB | 2.x (Flux query language — not InfluxQL) |

Never introduce a different language, runtime, or framework without explicit instruction. If you believe a different choice is better, say so and wait for confirmation before implementing.

---

## 3. Folder structure — do not invent new top-level directories

The monorepo layout is fixed:

```
krishisarth/
├── backend/
│   ├── app/
│   │   ├── api/v1/          ← route handlers only — no business logic
│   │   ├── services/        ← business logic called by routes
│   │   ├── models/          ← SQLAlchemy ORM models
│   │   ├── schemas/         ← Pydantic request/response shapes
│   │   ├── db/              ← postgres.py, influxdb.py, redis.py
│   │   ├── workers/         ← Celery task definitions
│   │   ├── mqtt/            ← subscriber client and handlers
│   │   ├── ml/              ← model files + training scripts
│   │   ├── middleware/       ← auth, ownership, rate_limit, logging
│   │   └── core/            ← config.py, security.py, constants.py
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   └── migrations/versions/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   ├── state/
│   │   └── utils/
│   └── assets/
└── firmware/
    └── src/
        ├── sensors/
        ├── comms/
        ├── actuators/
        └── utils/
```

**Rules:**
- Route handlers go in `api/v1/` — they validate input, call a service, return a response. Nothing else.
- Business logic goes in `services/` — never inline in routes.
- If a file does not fit an existing directory, ask before creating a new one.
- Never create a `utils.py` in the project root or inside `app/` — utilities belong in `app/core/`.

---

## 4. Naming conventions

### Python (backend)
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions and variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE` (defined in `app/core/constants.py`)
- Pydantic models: suffix with `Request`, `Response`, or `Out` (e.g., `FarmCreate`, `FarmOut`, `LoginRequest`, `TokenResponse`)
- SQLAlchemy models: singular noun, PascalCase (e.g., `Farmer`, `Farm`, `Zone`, `Device`)
- Services: suffix with `_service` in filename (e.g., `auth_service.py`, `irrigation_service.py`)

### JavaScript (frontend)
- Files: `kebab-case.js`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- DOM IDs referenced in JS: `kebab-case` matching the HTML

### Database
- Table names: `snake_case`, plural (e.g., `farmers`, `farms`, `zones`, `irrigation_schedules`)
- Column names: `snake_case`
- Index names: `idx_{table}_{column(s)}` (e.g., `idx_zones_farm`, `idx_alerts_unread`)
- Foreign key columns: `{referenced_table_singular}_id` (e.g., `farm_id`, `zone_id`, `farmer_id`)

### Firmware (C++)
- Files: `snake_case.cpp` / `snake_case.h`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants / macros: `UPPER_SNAKE_CASE`

---

## 5. Backend rules

### 5.1 Every route must use dependency injection for auth and ownership

```python
# CORRECT
@router.get("/farms/{farm_id}/zones")
async def list_zones(
    farm: Farm = Depends(verify_farm_owner),      # 403 if wrong farmer
    farmer: Farmer = Depends(get_current_farmer), # 401 if not logged in
    db: Session = Depends(get_db)
):
    ...

# WRONG — never check ownership inside the route handler body
@router.get("/farms/{farm_id}/zones")
async def list_zones(farm_id: str, db: Session = Depends(get_db)):
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if farm.farmer_id != current_farmer_id:  # DON'T do this inline
        raise HTTPException(403)
```

### 5.2 Cross-tenant access is always 403, never 404

When a resource exists but belongs to a different farmer, return `403 FORBIDDEN`. Never return `404 NOT_FOUND` — that would confirm the resource exists and enables enumeration attacks.

```python
# CORRECT
if str(farm.farmer_id) != str(request.state.farmer.id):
    raise HTTPException(status_code=403, detail="FORBIDDEN")

# WRONG
if str(farm.farmer_id) != str(request.state.farmer.id):
    raise HTTPException(status_code=404, detail="FARM_NOT_FOUND")
```

### 5.3 All error responses must use the standard envelope

```python
# Every HTTPException detail must be a string code, not a prose sentence
raise HTTPException(status_code=400, detail="VALIDATION_ERROR")
raise HTTPException(status_code=401, detail="TOKEN_EXPIRED")
raise HTTPException(status_code=409, detail="PUMP_ALREADY_RUNNING")

# The global exception handler wraps this in:
# {"success": false, "error": {"code": "PUMP_ALREADY_RUNNING", "message": "...", "request_id": "..."}}
```

Never raise an `HTTPException` with a human-readable sentence as the detail — the global handler and the frontend both key off the code string.

### 5.4 No raw SQL — use SQLAlchemy ORM for all PostgreSQL queries

```python
# CORRECT
farm = db.query(Farm).filter(Farm.id == farm_id, Farm.farmer_id == farmer_id).first()

# WRONG
result = db.execute(text("SELECT * FROM farms WHERE id = :id"), {"id": farm_id})
```

Exception: complex analytical queries using `text()` are allowed only in `analytics_service.py` and must be parameterized.

### 5.5 All InfluxDB queries use Flux — never InfluxQL

```python
# CORRECT
query = f'''
from(bucket: "krishisarth_sensors")
  |> range(start: -{hours}h)
  |> filter(fn: (r) => r._measurement == "soil_readings")
  |> filter(fn: (r) => r.zone_id == "{zone_id}")
  |> last()
'''

# WRONG — InfluxQL is v1 syntax, not supported in InfluxDB 2.x
query = f'SELECT last("moisture_pct") FROM soil_readings WHERE zone_id = "{zone_id}"'
```

### 5.6 Redis keys must follow the naming convention

```python
# Pattern: {namespace}:{identifier}
"rl:{token_prefix}:{time_window}"        # rate limiter
"revoked_jti:{jti}"                      # refresh token revocation
"irrigation_lock:{zone_id}"              # concurrent pump prevention
"login_fail:{email}"                     # brute force counter
"login_lock:{email}"                     # brute force lockout
"dashboard_cache:{farm_id}"              # dashboard snapshot
"weather_cache:{lat}_{lng}"              # OpenWeather response

# WRONG — vague or flat keys
"lock"
"cache_farm"
"jwt_revoked"
```

All Redis `setex` calls must include an explicit TTL. Never use `set` without expiry on application keys.

### 5.7 Celery tasks must store their task_id on the schedule record

```python
# irrigation_worker.py
task = execute_irrigation.delay(schedule_id, zone_id, duration_min)
# Immediately persist task_id so we can revoke it on manual stop
db.query(IrrigationSchedule).filter(...).update({"celery_task_id": task.id})
db.commit()
```

Without this, `POST /zones/:id/stop` cannot cancel the running Celery task.

### 5.8 Sensor data validation bounds (enforce these in ingestion handlers)

| Field | Min | Max |
|-------|-----|-----|
| moisture_pct | 0 | 100 |
| temp_c (soil / ambient) | -10 | 60 |
| ec_ds_m | 0 | 10 |
| ph | 0 | 14 |
| humidity_pct | 0 | 100 |
| pressure_bar | 0 | 10 |
| flow_lpm | 0 | 100 |

Out-of-range readings must be **rejected and not written to InfluxDB**. Generate a `SENSOR_FAULT` alert and log the raw value for debugging.

### 5.9 AI decision thresholds are constants — never hardcode inline

```python
# app/core/constants.py — these are the only correct values
AI_AUTO_EXECUTE_THRESHOLD = 0.80      # confidence >= 0.80 → auto-execute
AI_MANUAL_REVIEW_THRESHOLD = 0.60     # confidence 0.60–0.79 → flag for review
AI_MOISTURE_RULE_THRESHOLD = 0.25     # rule-based fallback trigger
TANK_CRITICAL_PCT = 10                # block irrigation below this level
MAX_CONCURRENT_PUMPS = 2              # per farm
PUMP_ACK_TIMEOUT_S = 10              # seconds to wait for relay ACK
ZONE_START_STAGGER_S = 300           # 5 min between zone starts in batch
BRUTE_FORCE_MAX_ATTEMPTS = 5
BRUTE_FORCE_WINDOW_S = 600           # 10 minutes
BRUTE_FORCE_LOCKOUT_S = 900          # 15 minutes
```

Never write `if confidence >= 0.80` inline. Always import from `constants`.

---

## 6. Database rules

### 6.1 All schema changes go through Alembic migrations

Never run `CREATE TABLE` or `ALTER TABLE` manually or via `Base.metadata.create_all()` against any environment. Every change must have a numbered migration file in `migrations/versions/`.

Migration naming: `{NNN}_{short_description}.py` (e.g., `007_add_device_key_hash.py`)

### 6.2 Migrations must be backward-compatible

- Adding a NOT NULL column? First add it as nullable, deploy, backfill data, then add the constraint in a separate migration.
- Renaming a column? Add the new column, migrate data, deprecate the old one — never rename directly.
- Never drop a column in the same migration that removes references to it.

### 6.3 All IDs are UUID — never use integer primary keys

```python
# CORRECT
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# WRONG
id = Column(Integer, primary_key=True, autoincrement=True)
```

### 6.4 Timestamps must be timezone-aware

```python
# CORRECT
created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

# WRONG
created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
```

Always use `TIMESTAMPTZ` in PostgreSQL. Never store naive datetimes.

---

## 7. Security rules — non-negotiable

### 7.1 Never store secrets in code

All secrets must come from environment variables via `app/core/config.py` (Pydantic `Settings`). Never hardcode:
- JWT secrets
- Database passwords
- API keys (OpenWeather, Twilio, etc.)
- AWS credentials
- Redis passwords
- InfluxDB tokens

If you need a secret in a test, use a fixture or a `.env.test` file that is gitignored.

### 7.2 Access tokens never go in localStorage or sessionStorage

The frontend must store the access token in a JavaScript variable only (`let accessToken = null` in `api/client.js`). If you see code that calls `localStorage.setItem('token', ...)` or `sessionStorage.setItem('token', ...)`, flag and remove it.

Refresh tokens travel exclusively as `httpOnly Secure SameSite=Strict` cookies — never in response bodies that get stored client-side.

### 7.3 bcrypt cost factor must be 12

```python
# CORRECT
salt = bcrypt.gensalt(rounds=12)

# WRONG — too weak
salt = bcrypt.gensalt(rounds=8)
```

### 7.4 Device API keys are stored as SHA-256 hashes — never plaintext

```python
# CORRECT — store the hash in the DB
key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
device.key_hash = key_hash

# WRONG — never store or log the raw key after provisioning
device.api_key = raw_key
```

### 7.5 Parameterize all database queries — no string interpolation

```python
# CORRECT
db.execute(text("SELECT * FROM farms WHERE id = :id"), {"id": farm_id})

# WRONG — SQL injection vulnerability
db.execute(f"SELECT * FROM farms WHERE id = '{farm_id}'")
```

### 7.6 CORS must be restrictive in production

```python
# CORRECT for production
origins = ["https://krishisarth.in", "https://www.krishisarth.in"]

# WRONG
origins = ["*"]
```

Use environment variables to switch between `["*"]` (development) and the explicit list (production). Never commit `"*"` as a hardcoded production value.

---

## 8. Frontend rules

### 8.1 All API calls go through `src/api/client.js`

Never call `fetch()` directly from a page or component. Every HTTP request must go through the `api()` function in `client.js`, which handles:
- Attaching the `Authorization: Bearer` header
- Silent token refresh on 401
- Typed error throwing from the error envelope

```javascript
// CORRECT
import { api } from '../api/client.js'
const data = await api('/farms/f1a2/dashboard')

// WRONG — direct fetch in a page file
const res = await fetch('https://api.krishisarth.in/v1/farms/f1a2/dashboard', {
  headers: { Authorization: `Bearer ${token}` }
})
```

### 8.2 No inline styles for colors — use Tailwind or CSS variables

The green palette and typography tokens are defined in `styles/tokens.css`. Always use:
- `var(--color-primary)` for the main green (#1a7a4a)
- Tailwind classes for layout and spacing

Do not hardcode hex colors inline in HTML or JavaScript.

### 8.3 Show staleness — never show stale data silently

Any data rendered from a cache or fallback must display a visual staleness indicator (timestamp + amber badge). Users must always know if they are seeing live or cached data.

### 8.4 Form validation fires client-side before the API call

Do not rely solely on server-side Pydantic validation for user-facing forms. Every form field must validate client-side in `utils/validation.js` with the same bounds defined in the backend constants (e.g., irrigation duration 1–120 min).

### 8.5 The dashboard page is the app entry point — not a login redirect

`index.html` loads the dashboard by default. If the user is not authenticated (no access token in memory), `client.js` redirects to `/login`. Do not add authentication checks scattered across individual pages.

---

## 9. Hardware / firmware rules

### 9.1 The relay safety timer is mandatory and must not be removable via software

The Pi gateway relay must have a hardcoded maximum duration cutoff:

```cpp
// firmware/src/actuators/relay.cpp
// This value MUST be enforced in hardware — never remove or make configurable via MQTT
const int RELAY_MAX_ON_SECONDS = scheduledDurationSeconds + 600; // +10 min
```

No MQTT command, API call, or software flag may disable or extend this cutoff. It is the last line of defense against flooding.

### 9.2 All pump control MQTT messages use QoS 1 (at-least-once)

```cpp
// CORRECT — QoS 1 for control commands
mqttClient.publish("krishisarth/zone/z1a2/pump/on", payload, false, 1);

// WRONG — QoS 0 loses messages on broker restart
mqttClient.publish("krishisarth/zone/z1a2/pump/on", payload, false, 0);
```

Sensor telemetry may use QoS 0 (acceptable data loss). Control commands must never use QoS 0.

### 9.3 Deep sleep cycle timing must not drift

The ESP32 sleep timer must target exactly 15-minute intervals. Use RTC wake time correction to account for the active sampling time, so readings stay aligned to clock boundaries:

```cpp
// Target: wake at :00, :15, :30, :45 of each hour
uint64_t activeDuration = millis() * 1000; // in microseconds
uint64_t sleepTarget = (15 * 60 * 1000000ULL) - activeDuration;
esp_sleep_enable_timer_wakeup(sleepTarget);
```

### 9.4 MQTT topic naming convention

```
krishisarth/{thing_type}/{id}/{subtopic}

Examples:
krishisarth/zone/z1a2/soil          ← sensor readings publish
krishisarth/zone/z1a2/pump/on       ← control command subscribe
krishisarth/zone/z1a2/pump/ack      ← relay ACK publish
krishisarth/gateway/gw01/status     ← gateway heartbeat
krishisarth/device/d1a2/ota         ← OTA trigger subscribe
```

Never use generic topics like `sensors`, `data`, or `krishisarth/all`. Every topic must include the resource type and UUID.

---

## 10. Testing rules

### 10.1 Every new service function must have at least one unit test

When you write a function in `services/`, write a corresponding test in `tests/unit/`. Minimum: one happy path test and one failure/edge case test.

### 10.2 Authentication must be mocked in integration tests — never use real JWTs

```python
# conftest.py provides a test_farmer fixture
# Integration tests use the TestClient with override dependencies

@pytest.fixture
def auth_headers(test_farmer):
    token = create_access_token(str(test_farmer.id))
    return {"Authorization": f"Bearer {token}"}
```

### 10.3 Never test against the production database or InfluxDB bucket

Integration tests use:
- PostgreSQL: a separate `krishisarth_test` database (created in conftest.py, dropped after session)
- InfluxDB: a separate `krishisarth_test` bucket
- Redis: database index 1 (`redis://localhost:6379/1`)

### 10.4 Tests must not depend on execution order

Each test must set up and tear down its own data. Never rely on a previous test having inserted a row.

### 10.5 Minimum coverage targets

| Module | Minimum coverage |
|--------|----------------|
| `app/services/` | 80% |
| `app/middleware/` | 90% |
| `app/api/v1/` | 70% |
| `app/workers/` | 60% |

Run coverage with: `pytest --cov=app --cov-fail-under=70`

---

## 11. Git and commit rules

### 11.1 Branch naming

```
feat/{short-description}      # new feature
fix/{short-description}       # bug fix
chore/{short-description}     # config, deps, tooling
test/{short-description}      # tests only
docs/{short-description}      # documentation
```

### 11.2 Commit message format

```
{type}: {short imperative description}

Optional body explaining why, not what.
```

Types: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`, `perf`

Examples:
```
feat: add ownership middleware for verify_zone_owner
fix: return 403 instead of 404 for cross-tenant farm access
chore: pin redis to 7.2.4 in requirements.txt
```

### 11.3 Never commit these files

- `.env` (any environment file with real secrets)
- `*.h5`, `*.pkl` model files (go to S3, not the repo) — exception: small stub models for tests
- `__pycache__/`, `.pytest_cache/`
- `node_modules/`
- `dist/` (frontend build output)
- Any file containing a real API key, password, or secret

---

## 12. Documentation rules

### 12.1 Every public function in `services/` must have a docstring

```python
# CORRECT
async def rotate_refresh_token(old_token: str) -> tuple[str, str, str]:
    """
    Verify the incoming refresh token, revoke its jti in Redis,
    and issue a new access token + refresh token pair.

    Returns: (new_access_token, new_refresh_token, farmer_id)
    Raises: HTTPException(401) if token is invalid, expired, or already revoked.
    """
    ...

# WRONG — no docstring on a public service function
async def rotate_refresh_token(old_token: str):
    ...
```

### 12.2 Non-obvious decisions must have an inline comment explaining why

```python
# CORRECT
# Return 403, not 404 — revealing that the farm exists enables resource enumeration
raise HTTPException(status_code=403, detail="FORBIDDEN")

# CORRECT
# QoS 1 is mandatory for control commands — QoS 0 loses messages on broker restart
mqttClient.publish(topic, payload, qos=1)
```

Do not comment what the code does. Comment why it does something non-obvious.

### 12.3 Keep TODO.md updated as you complete tasks

When a task is completed, update its checkbox from `[ ]` to `[x]`. When you start a task, mark it `[~]`. Do not leave TODO.md out of sync with the codebase.

---

## 13. Things that are explicitly forbidden

The following are hard prohibitions. If you are about to do any of these, stop and ask.

| Forbidden action | Why |
|-----------------|-----|
| Store access token in `localStorage` or `sessionStorage` | XSS can steal it — use in-memory only |
| Return `404` for a resource the current farmer doesn't own | Enables resource enumeration |
| Skip the relay safety timer or make it software-configurable | Hardware guarantee of pump cutoff must be unconditional |
| Use `QoS 0` for pump/valve control MQTT messages | Messages can be lost on broker restart |
| Write migration that drops a column with active foreign key references | Will break production on deploy |
| Inline AI confidence thresholds as magic numbers | Must come from `constants.py` |
| Add a new top-level package or directory without discussion | Breaks the established monorepo contract |
| Use `InfluxQL` syntax anywhere | Project uses InfluxDB 2.x — Flux only |
| Call `fetch()` directly in frontend page files | All requests go through `api/client.js` |
| Log raw device API keys | SHA-256 hash only — plaintext must never persist |
| Use `SameSite=Lax` or `SameSite=None` for the refresh token cookie | Must be `SameSite=Strict` |
| Trust `is_admin` or any privilege field from the JWT payload | Derive permissions from the DB, not the token |
| Run `Base.metadata.create_all()` against any non-test database | Alembic migrations only |
| Hardcode any URL with `aquabrain` in it | Project is KrishiSarth — any lingering reference is a bug |

---

## 14. When in doubt

1. Read `PROJECT_SPEC.md` before assuming anything about the architecture.
2. If the spec doesn't cover it, ask before implementing.
3. Prefer the explicit over the implicit — a verbose, clear solution beats a clever, opaque one.
4. Never silently change behavior that the spec defines — surface the conflict first.
5. If you find a bug, fix it and note it. Do not work around it silently in unrelated code.

---

*KrishiSarth PROJECT_RULES.md — last updated March 2026*
*This file must be kept in sync with PROJECT_SPEC.md. If a rule contradicts the spec, the spec wins — update this file to match.*
