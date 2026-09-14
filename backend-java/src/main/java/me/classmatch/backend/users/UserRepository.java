package me.classmatch.backend.users;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import me.classmatch.backend.users.dto.UserResponse;

@Repository
public class UserRepository {

    private final JdbcClient jdbcClient;

    public UserRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<UserResponse> findById(UUID userId) {
        return jdbcClient.sql("""
                SELECT id, email, name, created_at, bio, avatar_url
                FROM public.users
                WHERE id = :userId
                """)
                .param("userId", userId)
                .query(this::mapUser)
                .optional();
    }

    private UserResponse mapUser(ResultSet resultSet, int rowNumber)
            throws SQLException {
        return new UserResponse(
                resultSet.getObject("id", UUID.class),
                resultSet.getString("email"),
                resultSet.getString("name"),
                resultSet.getObject("created_at", java.time.OffsetDateTime.class),
                resultSet.getString("bio"),
                resultSet.getString("avatar_url")
        );
    }
}
