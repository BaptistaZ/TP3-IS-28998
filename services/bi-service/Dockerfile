FROM python:3.11-slim

WORKDIR /app

COPY services/bi-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/bi-service/ /app/

COPY services/grpc-service/generated/ /app/generated/
RUN test -f /app/generated/__init__.py || touch /app/generated/__init__.py

ENV PYTHONPATH=/app:/app/generated

EXPOSE 4000
CMD ["python", "server.py"]