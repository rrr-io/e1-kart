# Runtime image: the jar is built by GitHub Actions and copied next to this file.
# Ubuntu Noble (24.04) has Tesseract 5; the image also exists for arm64 (Ampere).
FROM eclipse-temurin:21-jre-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 10001 e1kart \
 && mkdir -p /data \
 && chown e1kart /data

WORKDIR /app
COPY app.jar /app/app.jar

USER e1kart
ENV E1KART_DB_PATH=/data/e1kart.db
EXPOSE 8080

# SerialGC and a capped heap: the server has 1 OCPU and also hosts other sites.
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-XX:MaxRAMPercentage=60", "-jar", "/app/app.jar"]
