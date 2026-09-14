package me.classmatch.backend.testing;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * @RestController makes this class an HTTP controller and serializes returned
 * Java objects to JSON. @RequestMapping supplies the common URL prefix.
 *
 * This controller is a temporary endpoint for verifying JWT authentication.
 * It can be removed once real authenticated endpoints cover the same behavior.
 */
@RestController
@RequestMapping("/api/test")
public class AuthenticatedTestController {

	// Handles GET /api/test/authenticated.
	@GetMapping("/authenticated")
	AuthenticatedResponse authenticated(@AuthenticationPrincipal Jwt jwt) {
		/*
		 * Spring Security has already validated the bearer token. It injects the
		 * decoded token here, and getSubject() returns its "sub" claim (the user ID).
		 */
		return new AuthenticatedResponse("authenticated", jwt.getSubject());
	}

	// A record is a compact immutable response type; Spring converts it to JSON.
	public record AuthenticatedResponse(String status, String userId) {
	}
}
