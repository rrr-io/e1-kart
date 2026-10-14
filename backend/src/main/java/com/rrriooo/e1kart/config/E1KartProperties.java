package com.rrriooo.e1kart.config;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.format.annotation.DateTimeFormat;

/** Game settings read from application.yml (prefix "e1kart"). */
@ConfigurationProperties(prefix = "e1kart")
public record E1KartProperties(
        String idSecret,
        boolean freePlayAllowed,
        int runsPerCertificate,
        String zone,
        String tesseractCommand,
        int ocrTimeoutSeconds,
        int maxConcurrentOcr,
        int uploadRateLimitPerMinute,
        List<VoteWindow> voteWindows) {

    public E1KartProperties {
        voteWindows = voteWindows == null ? List.of() : List.copyOf(voteWindows);
    }

    /** A valid voting window, in Korean local time. */
    public record VoteWindow(
            String label,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {

        public boolean contains(LocalDateTime t) {
            return !t.isBefore(start) && !t.isAfter(end);
        }
    }
}
