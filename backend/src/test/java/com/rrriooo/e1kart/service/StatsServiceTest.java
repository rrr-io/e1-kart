package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class StatsServiceTest {

    @Test
    void detailsAreCleanedAndShort() {
        assertEquals("night:hoonrari", StatsService.clean("Night:HOONRARI"));
        assertEquals("not_enhypen", StatsService.clean("NOT_ENHYPEN"));
        assertEquals("scriptalert1script", StatsService.clean("<script>alert(1)</script>"));
        assertEquals("-", StatsService.clean(null));
        assertEquals("-", StatsService.clean("  "));
        assertEquals(64, StatsService.clean("x".repeat(100)).length());
    }
}
