package com.rrriooo.e1kart.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rrriooo.e1kart.dto.MeResponse;
import com.rrriooo.e1kart.dto.TokenResponse;
import com.rrriooo.e1kart.service.PlayerService;
import com.rrriooo.e1kart.service.RunService;

@RestController
@RequestMapping("/api")
public class PlayerController {

    public static final String TOKEN_HEADER = "X-Player-Token";

    private final PlayerService playerService;
    private final RunService runService;

    public PlayerController(PlayerService playerService, RunService runService) {
        this.playerService = playerService;
        this.runService = runService;
    }

    @PostMapping("/players")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse create() {
        return new TokenResponse(playerService.create());
    }

    @GetMapping("/me")
    public MeResponse me(@RequestHeader(value = TOKEN_HEADER, required = false) String token) {
        return runService.summary(playerService.requirePlayer(token));
    }
}
