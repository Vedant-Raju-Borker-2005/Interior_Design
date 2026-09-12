FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY ids ./ids
RUN pip install --no-cache-dir -e ".[serve]"
COPY build ./build
COPY artifacts ./artifacts
ENV IDS_BLOBS=/app/build/data_blobs.js IDS_ARTIFACTS=/app/artifacts/latest
EXPOSE 8000
# design is CPU-bound and holds the GIL — scale with workers, not threads
CMD ["uvicorn", "ids.service:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
