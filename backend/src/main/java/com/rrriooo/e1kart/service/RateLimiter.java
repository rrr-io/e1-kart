package com.rrriooo.e1kart.service;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;

/** Upload-per-minute limit, in memory (60-second sliding window). */
@Component
public class RateLimiter {

    private static final long WINDOW_MS = 60_000;

    private final int limit;
    private final Clock clock;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimiter(E1KartProperties props) {
        this(props.uploadRateLimitPerMinute(), Clock.systemUTC());
    }

    RateLimiter(int limit, Clock clock) {
        this.limit = limit;
        this.clock = clock;
    }

    /** Throws RATE_LIMITED if any of the keys (e.g. player and IP) has gone over the limit. */
    public void check(String... keys) {
        long now = clock.millis();
        for (String key : keys) {
            Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
            synchronized (q) {
                while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) {
                    q.pollFirst();
                }
                if (q.size() >= limit) {
                    throw new ApiException(ErrorCode.RATE_LIMITED);
                }
            }
        }
        for (String key : keys) {
            Deque<Long> q = hits.get(key);
            synchronized (q) {
                q.addLast(now);
            }
        }
        if (hits.size() > 10_000) {
            hits.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return e.getValue().isEmpty() || now - e.getValue().peekLast() > WINDOW_MS;
                }
            });
        }
    }
}
