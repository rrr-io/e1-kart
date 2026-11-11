package com.rrriooo.e1kart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rrriooo.e1kart.model.Certificate;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {

    boolean existsByIdHash(String idHash);

    long countByPlayerId(String playerId);

    /** Runs granted by the player's certificates of one kind (a null kind is FANS_CHOICE). */
    @Query("select coalesce(sum(c.runsGranted), 0) from Certificate c where c.playerId = :playerId and coalesce(c.kind, 'FANS_CHOICE') = :kind")
    long sumRunsGranted(@Param("playerId") String playerId, @Param("kind") String kind);
}
