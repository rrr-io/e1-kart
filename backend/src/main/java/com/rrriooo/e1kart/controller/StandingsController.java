package com.rrriooo.e1kart.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rrriooo.e1kart.dto.StandingRow;
import com.rrriooo.e1kart.service.StandingsService;

/** Public E1 team standings (order only), shown in the menu and after an Interstellar race. */
@RestController
public class StandingsController {

    private final StandingsService standings;

    public StandingsController(StandingsService standings) {
        this.standings = standings;
    }

    @GetMapping("/api/standings")
    public List<StandingRow> standings() {
        return standings.standings();
    }
}
