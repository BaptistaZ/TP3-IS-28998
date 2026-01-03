FROM python:3.11-slim

WORKDIR /app

COPY services/crawler/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/crawler/ /app/

COPY samples/ /app/samples/

CMD ["python", "crawler.py"]