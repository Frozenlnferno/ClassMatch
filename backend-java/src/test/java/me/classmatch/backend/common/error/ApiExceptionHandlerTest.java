package me.classmatch.backend.common.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import me.classmatch.backend.users.UserNotFoundException;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void userNotFoundReturnsConsistentNotFoundResponse() {
        UUID userId = UUID.randomUUID();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/me");

        var result = handler.handleUserNotFound(new UserNotFoundException(userId), request);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(result.getBody()).isNotNull();
        assertThat(result.getBody().status()).isEqualTo(404);
        assertThat(result.getBody().error()).isEqualTo("Not Found");
        assertThat(result.getBody().message()).isEqualTo("User profile not found: " + userId);
        assertThat(result.getBody().path()).isEqualTo("/api/users/me");
        assertThat(result.getBody().timestamp()).isNotNull();
    }
}
