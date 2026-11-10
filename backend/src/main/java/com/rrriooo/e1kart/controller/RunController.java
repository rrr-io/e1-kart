package com.rrriooo.e1kart.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rrriooo.e1kart.dto.FinishRunRequest;
import com.rrriooo.e1kart.dto.StartRunRequest;
import com.rrriooo.e1kart.dto.StartRunResponse;
import com.rrriooo.e1kart.service.PlayerService;
import com.rrriooo.e1kart.service.RunService;
import com.rrriooo.e1kart.service.StandingsService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final PlayerService playerService;
    private final RunService runService;
    private final StandingsService standings;

    public RunController(PlayerService playerService, RunService runService, StandingsService standings) {
        this.playerService = playerService;
        this.runService = runService;
        this.standings = standings;
    }

    /** Consumes a run when the race starts. 402 if the balance is zero. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StartRunResponse start(@RequestHeader(value = PlayerController.TOKEN_HEADER, required = false) String token,
                                  @Valid @RequestBody StartRunRequest body) {
        return runService.start(playerService.requirePlayer(token), body.team());
    }

    /** Records the race's final time and position (for the team standings). */
    @PostMapping("/{runId}/finish")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void finish(@RequestHeader(value = PlayerController.TOKEN_HEADER, required = false) String token,
                       @PathVariable String runId,
                       @Valid @RequestBody FinishRunRequest body) {
        runService.finish(playerService.requirePlayer(token), runId, body.timeMs(), body.position());
        standings.invalidate(); // the player sees the standings with their race right after
    }
}
