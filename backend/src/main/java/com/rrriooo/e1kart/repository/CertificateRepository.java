package com.rrriooo.e1kart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rrriooo.e1kart.model.Certificate;

public interface CertificateRepository extends JpaRepository<Certificate, Long> {

    boolean existsByIdHash(String idHash);

    long countByPlayerId(String playerId);

    @Query("select coalesce(sum(c.runsGranted), 0) from Certificate c where c.playerId = :playerId")
    long sumRunsGranted(@Param("playerId") String playerId);
}
