FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY engine.py .
EXPOSE 8900
CMD ["uvicorn", "engine:app", "--host", "0.0.0.0", "--port", "8900"]
