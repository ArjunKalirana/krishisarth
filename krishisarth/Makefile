.PHONY: dev stop migrate migration test lint format seed seed-demo deploy

# Start local infrastructure and application services in development mode
dev:
	@echo "Starting KrishiSarth in development mode..."
	docker compose up -d
	@echo "Infrastructure started. Launching FastAPI and Celery worker..."
	# Run uvicorn and celery in parallel. Using shell wait to handle background processes.
	(cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) & \
	(cd backend && celery -A app.workers.main worker --loglevel=info) & \
	wait

# Stop all local infrastructure containers
stop:
	@echo "Stopping KrishiSarth infrastructure..."
	docker compose down

# Run all pending Alembic migrations to upgrade the database schema
migrate:
	@echo "Running database migrations..."
	cd backend && alembic upgrade head

# Generate a new Alembic migration script based on model changes
migration:
	@echo "Generating new migration: $(name)..."
	cd backend && alembic revision --autogenerate -m "$(name)"

# Run test suite with coverage report (fails if coverage is below 70%)
test:
	@echo "Running tests with coverage..."
	cd backend && pytest --cov=app --cov-report=term-missing --cov-fail-under=70

# Perform static analysis and check code formatting
lint:
	@echo "Linting backend code..."
	cd backend && flake8 app tests
	cd backend && black --check app tests

# Automatically format backend code to comply with Black standards
format:
	@echo "Formatting backend code..."
	cd backend && black app tests

# Seed the database with initial development data
seed:
	@echo "Seeding database..."
	cd backend && python scripts/seed.py

# Seed the specific judge's demo account
seed-demo:
	@echo "Seeding judge's demo account..."
	cd backend && python scripts/seed_demo.py

# Prepare EVERYTHING for the stage demo in one command
demo-ready:
	@echo "Pre-stage automation in progress..."
	cd backend && python scripts/start_demo.py

# Placeholder for production deployment configuration
deploy:
	@echo "Configure Render deployment first — see PROJECT_SPEC.md Section 10"
