package me.classmatch.backend.users.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserResponse(
        UUID id,
        String email,
        String name,

        @JsonProperty("created_at")
        OffsetDateTime createdAt,

        String bio,

        @JsonProperty("avatar_url")
        String avatarUrl
) {
}
