package com.rrriooo.e1kart.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Anonymous player. The token stays only on the device; here we store its SHA-256 hash. */
@Entity
@Table(name = "player")
public class Player {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Player() {
    }

    public Player(String id, String tokenHash, Instant createdAt) {
        this.id = id;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
