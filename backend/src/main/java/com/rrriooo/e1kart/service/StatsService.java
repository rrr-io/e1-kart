package com.rrriooo.e1kart.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;
import com.rrriooo.e1kart.model.StatCounter;
import com.rrriooo.e1kart.repository.StatCounterRepository;

/**
 * Anonymous, cookie-free usage stats kept in the game's own database (no external service).
 * The game sends a few events (visit with its source, race started/finished, share, install) and the server counts
 * certificate uploads by outcome. Only daily totals are stored. Unique visitors are counted with a hash of
 * IP + browser + day + a random salt that lives only in memory and changes every day, so a visitor can't be
 * recognised the next day and nothing personal ever reaches the disk.
 */
@Service
public class StatsService {

    private static final Logger log = LoggerFactory.getLogger(StatsService.class);
    /** Events the game may send, and the server-side ones. */
    private static final Set<String> CLIENT_EVENTS = Set.of("visit", "device", "mode", "race_start", "race_finish", "share", "install", "mnet");

    private final StatCounterRepository counters;
    private final ZoneId zone;
    private final Clock clock;
    private final RateLimiter limiter = new RateLimiter(120, Clock.systemUTC()); // events per minute per IP
    private final Set<String> seenToday = ConcurrentHashMap.newKeySet();
    private volatile String saltDay = "";
    private volatile byte[] salt = new byte[16];

    public StatsService(StatCounterRepository counters, E1KartProperties props) {
        this.counters = counters;
        this.zone = ZoneId.of(props.statsZone() == null || props.statsZone().isBlank() ? "Europe/Rome" : props.statsZone());
        this.clock = Clock.systemUTC();
    }

    private String today() {
        return LocalDate.now(clock.withZone(zone)).toString();
    }

    /** Lower-case a-z0-9 and . : _ - only, at most 64 characters; empty becomes "-". */
    static String clean(String s) {
        if (s == null) {
            return "-";
        }
        String c = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.:_-]", "");
        if (c.length() > 64) {
            c = c.substring(0, 64);
        }
        return c.isEmpty() ? "-" : c;
    }

    /** Counts one event; never fails the caller. */
    public void count(String name, String dim) {
        try {
            counters.bump(today(), clean(name), clean(dim));
        } catch (RuntimeException e) {
            log.warn("Stats not saved: {}", e.getMessage());
        }
    }

    /** An event sent by the game: unknown names are ignored, bursts from one address are refused. */
    public void clientEvent(String name, String dim, String ip, String userAgent) {
        String n = clean(name);
        if (!CLIENT_EVENTS.contains(n)) {
            return;
        }
        try {
            limiter.check("stats:" + ip);
        } catch (ApiException e) {
            return; // silently dropped: stats must never bother the player
        }
        count(n, dim);
        if (n.equals("visit") && firstVisitToday(ip, userAgent)) {
            count("visitor", dim);
        }
    }

    private boolean firstVisitToday(String ip, String userAgent) {
        String day = today();
        if (!day.equals(saltDay)) {
            synchronized (this) {
                if (!day.equals(saltDay)) {
                    seenToday.clear();
                    byte[] s = new byte[16];
                    new SecureRandom().nextBytes(s);
                    salt = s;
                    saltDay = day;
                }
            }
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt);
            md.update((ip + "|" + userAgent + "|" + day).getBytes(StandardCharsets.UTF_8));
            return seenToday.add(HexFormat.of().formatHex(md.digest(), 0, 12));
        } catch (NoSuchAlgorithmException e) {
            return false;
        }
    }

    /** Daily counters of the last `days` days (today included). */
    public List<StatCounter> lastDays(int days) {
        int d = Math.max(1, Math.min(days, 366));
        return counters.findByDayGreaterThanEqualOrderByDayAsc(LocalDate.now(clock.withZone(zone)).minusDays(d - 1L).toString());
    }

    /** Checks the admin token of the stats page; a server without a token has no stats page. */
    public void requireAdmin(String token, String expected) {
        if (expected == null || expected.isBlank()) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        if (token == null || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(ErrorCode.NOT_AUTHORIZED);
        }
    }
}
