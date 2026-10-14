package com.rrriooo.e1kart.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.rrriooo.e1kart.model.Player;

public interface PlayerRepository extends JpaRepository<Player, String> {

    Optional<Player> findByTokenHash(String tokenHash);
}
