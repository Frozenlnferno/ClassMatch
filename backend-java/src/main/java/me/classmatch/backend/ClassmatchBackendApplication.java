package me.classmatch.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
 * Marks this as the application's starting point. @SpringBootApplication also
 * enables automatic configuration and scans this package (and its subpackages)
 * for Spring components such as controllers and configuration classes.
 */
@SpringBootApplication
public class ClassmatchBackendApplication {

	public static void main(String[] args) {
		// Creates Spring's application context and starts the embedded web server.
		SpringApplication.run(ClassmatchBackendApplication.class, args);
	}

}
