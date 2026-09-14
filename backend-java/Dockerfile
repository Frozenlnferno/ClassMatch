FROM maven:3.9-eclipse-temurin-21-alpine AS base

WORKDIR /app

# Resolve dependencies separately so they remain cached until pom.xml changes.
COPY pom.xml ./
RUN mvn --batch-mode dependency:go-offline


# -------------------
# DEV
# -------------------
FROM base AS dev

COPY src ./src

CMD ["mvn", "spring-boot:run"]


# -------------------
# BUILD
# -------------------
FROM base AS build

COPY src ./src

RUN mvn --batch-mode --no-transfer-progress -DskipTests package \
    && cp target/*.jar /app/application.jar


# -------------------
# PROD
# -------------------
FROM eclipse-temurin:21-jre-alpine AS prod

WORKDIR /app

RUN addgroup -S spring \
    && adduser -S -G spring spring

COPY --from=build --chown=spring:spring /app/application.jar ./application.jar

USER spring:spring

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "application.jar"]
