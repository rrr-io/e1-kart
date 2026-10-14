package com.rrriooo.e1kart.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;
import com.rrriooo.e1kart.model.Player;
import com.rrriooo.e1kart.repository.PlayerRepository;

/** Anonymous players identified by a random token that stays on the device. */
@Service
public class PlayerService {

    private final PlayerRepository players;
    private final SecureRandom random = new SecureRandom();

    public PlayerService(PlayerRepository players) {
        this.players = players;
    }

    /** Creates a player and returns the plain token (the only time it exists outside the device). */
    @Transactional
    public String create() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        players.save(new Player(UUID.randomUUID().toString(), sha256(token), Instant.now()));
        return token;
    }

    @Transactional(readOnly = true)
    public Player requirePlayer(String token) {
        if (token == null || token.isBlank() || token.length() > 100) {
            throw new ApiException(ErrorCode.INVALID_PLAYER);
        }
        return players.findByTokenHash(sha256(token)).orElseThrow(() -> new ApiException(ErrorCode.INVALID_PLAYER));
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
