package com.rrriooo.e1kart.model;

import java.time.Instant;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * A voting certificate that has already been redeemed. The certificate's ID is never stored
 * in plain text: id_hash is the HMAC of the normalized ID, and the UNIQUE constraint prevents reuse.
 */
@Entity
@Table(name = "certificate", indexes = @Index(name = "idx_certificate_player", columnList = "player_id"))
public class Certificate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_hash", nullable = false, unique = true, length = 64)
    private String idHash;

    @Column(name = "player_id", nullable = false, length = 36)
    private String playerId;

    /** Date and time of the vote, read from the certificate (Korean time). */
    @Column(name = "participation_at", nullable = false)
    private LocalDateTime participationAt;

    /** E.g. "FANS' CHOICE CATEGORY 1ST VOTE", if readable. */
    @Column(length = 120)
    private String category;

    @Column(name = "runs_granted", nullable = false)
    private int runsGranted;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    protected Certificate() {
    }

    public Certificate(String idHash, String playerId, LocalDateTime participationAt, String category, int runsGranted, Instant uploadedAt) {
        this.idHash = idHash;
        this.playerId = playerId;
        this.participationAt = participationAt;
        this.category = category;
        this.runsGranted = runsGranted;
        this.uploadedAt = uploadedAt;
    }

    public Long getId() {
        return id;
    }

    public String getIdHash() {
        return idHash;
    }

    public String getPlayerId() {
        return playerId;
    }

    public LocalDateTime getParticipationAt() {
        return participationAt;
    }

    public String getCategory() {
        return category;
    }

    public int getRunsGranted() {
        return runsGranted;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }
}
