package com.rrriooo.e1kart.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** A race paid for with a run. Free-play races never go through the server. */
@Entity
@Table(name = "run", indexes = @Index(name = "idx_run_player", columnList = "player_id"))
public class Run {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "player_id", nullable = false, length = 36)
    private String playerId;

    /** Index of the chosen team (0..5). */
    @Column(nullable = false)
    private int team;

    /** Which runs it used: FANS_CHOICE (Interstellar) or MCD (Bloody Paradise); null for older races (FANS' CHOICE). */
    @Column(length = 16)
    private String kind;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    /** Total race time in milliseconds. */
    @Column(name = "time_ms")
    private Long timeMs;

    /** Finishing position (1..6), for the team standings. Null for races finished by older versions. */
    @Column(name = "position")
    private Integer position;

    protected Run() {
    }

    public Run(String id, String playerId, int team, CertificateKind kind, Instant startedAt) {
        this.id = id;
        this.playerId = playerId;
        this.team = team;
        this.kind = kind.name();
        this.startedAt = startedAt;
    }

    public void finish(long timeMs, Integer position, Instant at) {
        this.timeMs = timeMs;
        this.position = position;
        this.finishedAt = at;
    }

    public boolean isFinished() {
        return finishedAt != null;
    }

    public String getId() {
        return id;
    }

    public String getPlayerId() {
        return playerId;
    }

    public int getTeam() {
        return team;
    }

    public CertificateKind getKind() {
        return CertificateKind.of(kind);
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public Long getTimeMs() {
        return timeMs;
    }

    public Integer getPosition() {
        return position;
    }
}
