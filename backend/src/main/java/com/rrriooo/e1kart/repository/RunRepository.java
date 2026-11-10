package com.rrriooo.e1kart.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rrriooo.e1kart.model.Run;

public interface RunRepository extends JpaRepository<Run, String> {

    long countByPlayerId(String playerId);

    Optional<Run> findByIdAndPlayerId(String id, String playerId);

    /** Finished races with a position, since the start of the standings season. */
    List<Run> findByFinishedAtGreaterThanEqualAndPositionIsNotNull(Instant since);
}
