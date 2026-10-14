package com.rrriooo.e1kart.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rrriooo.e1kart.model.Run;

public interface RunRepository extends JpaRepository<Run, String> {

    long countByPlayerId(String playerId);

    Optional<Run> findByIdAndPlayerId(String id, String playerId);
}
