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

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    /** Total race time in milliseconds, for a future leaderboard. */
    @Column(name = "time_ms")
    private Long timeMs;

    protected Run() {
    }

    public Run(String id, String playerId, int team, Instant startedAt) {
        this.id = id;
        this.playerId = playerId;
        this.team = team;
        this.startedAt = startedAt;
    }

    public void finish(long timeMs, Instant at) {
        this.timeMs = timeMs;
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

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public Long getTimeMs() {
        return timeMs;
    }
}
