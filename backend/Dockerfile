FROM python:3.13.13-slim-bookworm AS base

WORKDIR /app

# Prevent Python from writing .pyc (cache) files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# -------------------
# DEV
# -------------------
FROM base AS dev
COPY . .
CMD ["flask", "--app", "app", "run", "--debug", "--host=0.0.0.0", "--port=5000"]


# -------------------
# PROD
# -------------------
FROM base AS prod
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
