package com.rrriooo.e1kart.dto;

import java.time.LocalDateTime;

/**
 * Data read from the certificate screenshot.
 *
 * @param rawId           ID as read by the OCR (e.g. 61013P5EM74JDMJZ)
 * @param normalizedId    normalized ID used for the hash (O becomes 0, I becomes 1)
 * @param participationAt date and time of the vote, Korean time
 * @param category        category and round, null if not readable
 */
public record ParsedCertificate(String rawId, String normalizedId, LocalDateTime participationAt, String category) {
}
