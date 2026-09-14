package me.classmatch.backend.security;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/*
 * Defines the security rules applied before a request reaches a controller.
 * @Configuration tells Spring that this class creates application-level beans.
 */
@Configuration
// Enables injection of the values represented by SecurityProperties.
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

	/*
	 * A @Bean method gives the returned object to Spring to manage. This filter
	 * chain controls authentication and authorization for incoming HTTP requests.
	 */
	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http
				// This API uses bearer tokens, not cookie-based server sessions.
				.csrf(AbstractHttpConfigurer::disable)
				// Uses the CorsConfigurationSource bean defined below.
				.cors(Customizer.withDefaults())
				// Supabase handles login, so Spring's built-in login methods are unused.
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				// Every request must carry its own JWT; no login state is stored here.
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(authorize -> authorize
						// Monitoring endpoints do not require a logged-in user.
						.requestMatchers("/actuator/health", "/actuator/info").permitAll()
						// Browsers use unauthenticated OPTIONS requests for CORS preflight.
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						// All application API endpoints require a valid JWT.
						.requestMatchers("/api/**").authenticated()
						// New routes are closed by default until deliberately allowed above.
						.anyRequest().denyAll())
				// Validates Authorization: Bearer <token> as an OAuth2 JWT.
				.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
				.build();
	}

	/*
	 * CORS is enforced by browsers when the frontend and backend have different
	 * origins. This bean describes which frontend requests Spring Security accepts.
	 */
	@Bean
	CorsConfigurationSource corsConfigurationSource(SecurityProperties properties) {
		CorsConfiguration configuration = new CorsConfiguration();

		// Loaded from FRONTEND_ORIGIN, with the local default in application.yaml.
		configuration.setAllowedOrigins(List.of(properties.frontendOrigin().toString()));
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
		// Permits credentialed browser requests; the allowed origin must be explicit.
		configuration.setAllowCredentials(true);
		// Lets the browser cache a successful preflight response for one hour.
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		// Apply these CORS rules only to application API routes.
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}
}
