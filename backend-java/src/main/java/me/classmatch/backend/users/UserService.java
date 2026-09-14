package me.classmatch.backend.users;

import java.util.UUID;

import org.springframework.stereotype.Service;

import me.classmatch.backend.users.dto.UserResponse;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserResponse getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
    }

    public UserResponse updateCurrentUserInfo(UUID userId, me.classmatch.backend.users.dto.UpdateUserRequest request) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (request.name() != null) {
            user.setName(request.name());
        }
        if (request.bio() != null) {
            user.setBio(request.bio());
        }
        if (request.profilePictureUrl() != null) {
            user.setProfilePictureUrl(request.profilePictureUrl());
        }

        userRepository.save(user);
        return new UserResponse(user.getId(), user.getName(), user.getBio(), user.getProfilePictureUrl());
    }
}
