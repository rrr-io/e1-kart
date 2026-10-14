package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.rrriooo.e1kart.exception.ApiException;

class RateLimiterTest {

    /** Clock we can advance by hand. */
    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-14T10:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @Test
    void blocksAfterLimitAndRecoversAfterAMinute() {
        TestClock clock = new TestClock();
        RateLimiter limiter = new RateLimiter(2, clock);
        limiter.check("player:a", "ip:1");
        limiter.check("player:a", "ip:1");
        assertThrows(ApiException.class, () -> limiter.check("player:a", "ip:1"));

        // Another player from the same IP is still blocked.
        assertThrows(ApiException.class, () -> limiter.check("player:b", "ip:1"));

        clock.now = clock.now.plus(Duration.ofSeconds(61));
        assertDoesNotThrow(() -> limiter.check("player:a", "ip:1"));
    }
}
