package me.classmatch.backend.users.dto;

import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
    @Size(max = 50, message = "Name must be at most 50 characters long")
    String name,

    @Size(max = 500, message = "Bio must be at most 500 characters long")
    String bio,
    
    String profilePictureUrl
) {
}
