FROM python:3.11-slim

WORKDIR /app

COPY services/grpc-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/grpc-service/ /app/

RUN test -f /app/generated/__init__.py || touch /app/generated/__init__.py

EXPOSE 50051
CMD ["python", "server.py"]