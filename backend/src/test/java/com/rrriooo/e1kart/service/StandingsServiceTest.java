package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.rrriooo.e1kart.dto.StandingRow;
import com.rrriooo.e1kart.model.Run;

class StandingsServiceTest {

    private static Run race(int team, int position) {
        Run r = new Run(team + "-" + position + "-" + Math.random(), "p", team, Instant.now());
        r.finish(120_000, position, Instant.now());
        return r;
    }

    @Test
    void teamsAreRankedByPointsThenRaces() {
        List<Run> runs = new ArrayList<>();
        runs.add(race(3, 1));                    // HOONRARI 25
        runs.add(race(0, 2));                    // MCJAKEY 18 + 8 = 26, two races
        runs.add(race(0, 6));
        runs.add(race(2, 1));                    // ALPINOO 25, same as HOONRARI
        List<StandingRow> s = StandingsService.rank(runs);
        assertEquals(0, s.get(0).team());
        assertEquals(Integer.valueOf(1), s.get(0).rank());
        assertEquals(2, s.get(1).team());        // tie on points and races: same place, lower index first
        assertEquals(Integer.valueOf(2), s.get(1).rank());
        assertEquals(3, s.get(2).team());
        assertEquals(Integer.valueOf(2), s.get(2).rank());
        assertNull(s.get(3).rank());             // no races yet
        assertEquals(6, s.size());
    }
}
