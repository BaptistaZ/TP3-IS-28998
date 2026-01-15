# Build
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

# Runtime
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/rpc-service-java-1.0.0.jar /app/app.jar
EXPOSE 9000
ENV RPC_SERVICE_PORT=9000
CMD ["java", "-jar", "/app/app.jar"]