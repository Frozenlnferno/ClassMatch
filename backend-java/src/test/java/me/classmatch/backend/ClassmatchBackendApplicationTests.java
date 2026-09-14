package me.classmatch.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/*
 * These are integration tests: they start the Spring application, exercise its
 * HTTP security with MockMvc, and use a temporary PostgreSQL Docker container.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ClassmatchBackendApplicationTests {

	// Testcontainers starts this database before the tests and stops it afterward.
	@Container
	// Supplies the container's connection details to Spring's DataSource.
	@ServiceConnection
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

	// MockMvc sends test HTTP requests without opening a real network port.
	@Autowired
	MockMvc mockMvc;

	@Autowired
	JdbcClient jdbcClient;

	@Test
	void isolatedPostgresIsReachable() {
		Integer result = jdbcClient.sql("SELECT 1").query(Integer.class).single();

		assertThat(result).isEqualTo(1);
	}

	@Test
	void protectedEndpointRejectsAnonymousRequests() throws Exception {
		mockMvc.perform(get("/api/test/authenticated"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void protectedEndpointReturnsAuthenticatedUser() throws Exception {
		// jwt() adds a trusted mock JWT so this test does not contact Supabase.
		mockMvc.perform(get("/api/test/authenticated")
					.with(jwt().jwt(token -> token.subject("user-123"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("authenticated"))
				.andExpect(jsonPath("$.userId").value("user-123"));
	}

	@Test
	void corsAllowsConfiguredFrontendOrigin() throws Exception {
		// Reproduce the preflight request a browser sends before a CORS request.
		mockMvc.perform(options("/api/test/authenticated")
					.header("Origin", "http://localhost:5173")
					.header("Access-Control-Request-Method", "GET"))
				.andExpect(status().isOk())
				.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
	}
}
