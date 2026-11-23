# Production-ready Dockerfile for Google Cloud Run
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Run as non-root user for security best practices
RUN useradd -m -u 1000 trustcore && chown -R trustcore:trustcore /app
USER trustcore

# Expose standard Cloud Run port
EXPOSE 8000

# Run uvicorn bound to 0.0.0.0 and PORT dynamically
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
