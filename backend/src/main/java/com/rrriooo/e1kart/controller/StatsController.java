package com.rrriooo.e1kart.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.dto.StatEventRequest;
import com.rrriooo.e1kart.dto.StatRow;
import com.rrriooo.e1kart.service.StatsService;

import jakarta.servlet.http.HttpServletRequest;

/** Anonymous usage stats: events from the game, and the daily totals for the private stats page. */
@RestController
public class StatsController {

    public static final String TOKEN_HEADER = "X-Stats-Token";

    private final StatsService stats;
    private final E1KartProperties props;

    public StatsController(StatsService stats, E1KartProperties props) {
        this.stats = stats;
        this.props = props;
    }

    /** One event from the game, e.g. {"name": "visit", "dim": "instagram"}. Always 204. */
    @PostMapping("/api/events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void event(@RequestBody(required = false) StatEventRequest body, HttpServletRequest request) {
        if (body != null) {
            stats.clientEvent(body.name(), body.dim(), request.getRemoteAddr(), request.getHeader("User-Agent"));
        }
    }

    /** Daily totals of the last `days` days, for /stats.html. Needs the X-Stats-Token header. */
    @GetMapping("/api/stats")
    public List<StatRow> stats(@RequestHeader(value = TOKEN_HEADER, required = false) String token,
                               @RequestParam(defaultValue = "30") int days) {
        stats.requireAdmin(token, props.statsToken());
        return stats.lastDays(days).stream().map(c -> new StatRow(c.getDay(), c.getName(), c.getDim(), c.getCount())).toList();
    }
}
