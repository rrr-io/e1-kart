package com.rrriooo.e1kart.dto;

import java.time.LocalDateTime;
import java.util.List;

/** freeBoardTracks: the free tracks whose races this server counts for the standings (the game asks before sending them). */
public record ConfigResponse(boolean freePlayAllowed, int runsPerCertificate, List<Window> voteWindows, List<String> freeBoardTracks) {

    public record Window(String label, LocalDateTime start, LocalDateTime end) {
    }
}
