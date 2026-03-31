FROM python:3.11-slim


ENV PYTHONDONTWRITEBYTECODE=1 \
   PYTHONUNBUFFERED=1 \
   PIP_NO_CACHE_DIR=1


WORKDIR /app


COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt


COPY . /app


# Seed files copied into a persistent volume on first run
RUN mkdir -p /seed/data && cp /app/data/golden.csv /seed/data/golden.csv


COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["entrypoint.sh"]
