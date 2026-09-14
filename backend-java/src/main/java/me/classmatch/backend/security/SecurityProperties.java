package me.classmatch.backend.security;

import java.net.URI;

import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/*
 * Loads classmatch.security.* values from application.yaml. Using a typed
 * properties record keeps environment-specific values out of Java code.
 */
@Validated
@ConfigurationProperties(prefix = "classmatch.security")
public record SecurityProperties(
		// Validation makes startup fail with a clear error if this value is absent.
		@NotNull URI frontendOrigin) {
}
