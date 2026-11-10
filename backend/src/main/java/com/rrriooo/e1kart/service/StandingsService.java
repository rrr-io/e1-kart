package com.rrriooo.e1kart.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.dto.StandingRow;
import com.rrriooo.e1kart.model.Run;
import com.rrriooo.e1kart.repository.RunRepository;

/**
 * E1 team standings, from the races paid for with a run (Interstellar: every race is a vote). Each finished race
 * gives its team points by position, F1-style (25, 18, 15, 12, 10, 8); teams are ranked by points, then by number
 * of races. Only the ranking leaves the server: the points stay internal.
 */
@Service
public class StandingsService {

    static final int TEAMS = 6;
    private static final int[] POINTS = {25, 18, 15, 12, 10, 8};
    private static final long CACHE_MS = 20_000;

    private final RunRepository runs;
    private final Instant since;
    private volatile List<StandingRow> cached;
    private volatile long cachedAt;

    public StandingsService(RunRepository runs, E1KartProperties props) {
        this.runs = runs;
        String s = props.standingsSince();
        this.since = s == null || s.isBlank() ? Instant.EPOCH
                : LocalDate.parse(s.trim()).atStartOfDay(ZoneId.of(props.zone() == null ? "Asia/Seoul" : props.zone())).toInstant();
    }

    @Transactional(readOnly = true)
    public List<StandingRow> standings() {
        long now = System.currentTimeMillis();
        List<StandingRow> c = cached;
        if (c != null && now - cachedAt < CACHE_MS) {
            return c;
        }
        c = rank(runs.findByFinishedAtGreaterThanEqualAndPositionIsNotNull(since));
        cached = c;
        cachedAt = now;
        return c;
    }

    /** Forgets the cached standings, so a race just finished counts at once. */
    public void invalidate() {
        cached = null;
    }

    /** Ranking of the six teams from finished races; teams with equal points and races share the place. */
    static List<StandingRow> rank(List<Run> finished) {
        long[] points = new long[TEAMS], races = new long[TEAMS];
        for (Run r : finished) {
            int t = r.getTeam(), p = r.getPosition() == null ? 0 : r.getPosition();
            if (t < 0 || t >= TEAMS || p < 1 || p > POINTS.length) {
                continue;
            }
            points[t] += POINTS[p - 1];
            races[t]++;
        }
        List<Integer> order = new ArrayList<>();
        for (int t = 0; t < TEAMS; t++) {
            order.add(t);
        }
        order.sort(Comparator.<Integer>comparingLong(t -> -points[t]).thenComparingLong(t -> -races[t]).thenComparingInt(t -> t));
        List<StandingRow> out = new ArrayList<>();
        int rank = 0;
        for (int i = 0; i < order.size(); i++) {
            int t = order.get(i);
            if (races[t] == 0) {
                out.add(new StandingRow(t, null));
                continue;
            }
            boolean tie = i > 0 && points[order.get(i - 1)] == points[t] && races[order.get(i - 1)] == races[t];
            if (!tie) {
                rank = i + 1;
            }
            out.add(new StandingRow(t, rank));
        }
        return out;
    }
}
