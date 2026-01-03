FROM python:3.11-slim

WORKDIR /app

COPY services/rpc-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/rpc-service/ /app/

EXPOSE 9000
CMD ["python", "server.py"]