package com.rrriooo.e1kart.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ConfigResponse(boolean freePlayAllowed, int runsPerCertificate, List<Window> voteWindows) {

    public record Window(String label, LocalDateTime start, LocalDateTime end) {
    }
}
