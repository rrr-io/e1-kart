package com.rrriooo.e1kart.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rrriooo.e1kart.model.Run;

public interface RunRepository extends JpaRepository<Run, String> {

    long countByPlayerId(String playerId);

    /** Races started with runs of one kind (a null kind is FANS_CHOICE). */
    @Query("select count(r) from Run r where r.playerId = :playerId and coalesce(r.kind, 'FANS_CHOICE') = :kind")
    long countByPlayerIdAndKind(@Param("playerId") String playerId, @Param("kind") String kind);

    Optional<Run> findByIdAndPlayerId(String id, String playerId);

    /** Finished races with a position, since the start of the standings season. */
    List<Run> findByFinishedAtGreaterThanEqualAndPositionIsNotNull(Instant since);
}
