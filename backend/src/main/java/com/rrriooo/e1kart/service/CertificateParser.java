package com.rrriooo.e1kart.service;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.rrriooo.e1kart.dto.ParsedCertificate;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;

/**
 * Extracts ID, date and category from the OCR text of a MAMA (Mnet Plus) voting certificate.
 * Pure class with no Spring dependencies, testable on its own.
 *
 * <pre>
 * VOTING CERTIFICATE
 * 2026 MAMA AWARDS
 * FANS' CHOICE Category 1st VOTE
 * Participation Date 2026.10.13 21:42
 * This Certificate verifies that it was issued by Mnet Plus.
 * No. 61013P5EM74JDMJZ
 * </pre>
 */
public class CertificateParser {

    /** "No." (the OCR sometimes reads N0) followed by 16 uppercase alphanumeric characters. */
    private static final Pattern ID = Pattern.compile("\\bN[O0]\\s*[.,:]?\\s*([0-9A-Z]{16})(?![0-9A-Z])");

    /** Participation date in the format 2026.10.13 21:42. */
    private static final Pattern DATE = Pattern.compile("(\\d{4})[.\\-/](\\d{2})[.\\-/](\\d{2})\\s+(\\d{2}):(\\d{2})");

    /** Category line, right after "MAMA AWARDS": e.g. FANS' CHOICE CATEGORY 1ST VOTE. */
    private static final Pattern CATEGORY = Pattern.compile("AWARDS\\s+([A-Z][A-Z' ]*?CATEGORY\\s+\\d+(?:ST|ND|RD|TH))\\s+VOTE");

    public ParsedCertificate parse(String ocrText) {
        if (!isCertificateText(ocrText)) {
            throw new ApiException(ErrorCode.NOT_A_CERTIFICATE);
        }
        ParsedCertificate parsed = parseFields(ocrText);
        if (parsed.rawId() == null) {
            throw new ApiException(ErrorCode.ID_NOT_FOUND);
        }
        if (parsed.participationAt() == null) {
            throw new ApiException(ErrorCode.DATE_NOT_FOUND);
        }
        return parsed;
    }

    /** True when the text has the words of a certificate: "VOTING CERTIFICATE", "MAMA" and "Mnet Plus". */
    public boolean isCertificateText(String ocrText) {
        if (ocrText == null || ocrText.isBlank()) {
            return false;
        }
        String compact = ocrText.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return compact.contains("VOTINGCERTIFICATE") && compact.contains("MAMA") && compact.contains("MNETPLUS");
    }

    /**
     * ID, date and category, each null when it can't be read; never throws. Used by the lenient redemption,
     * where the ID is read from the "No." line of the card (IdReader) and an unreadable date is not an error.
     */
    public ParsedCertificate parseFields(String ocrText) {
        String upper = (ocrText == null ? "" : ocrText).toUpperCase(Locale.ROOT).replace('’', '\'').replace('‘', '\'');
        String flat = upper.replaceAll("\\s+", " ");

        Matcher id = ID.matcher(flat);
        String rawId = id.find() ? id.group(1) : null;

        Matcher date = DATE.matcher(flat);
        LocalDateTime participationAt = null;
        if (date.find()) {
            try {
                participationAt = LocalDateTime.of(
                        Integer.parseInt(date.group(1)), Integer.parseInt(date.group(2)), Integer.parseInt(date.group(3)),
                        Integer.parseInt(date.group(4)), Integer.parseInt(date.group(5)));
            } catch (DateTimeException e) {
                participationAt = null;
            }
        }

        Matcher cat = CATEGORY.matcher(flat);
        String category = cat.find() ? cat.group(1).trim().replaceAll(" +", " ") + " VOTE" : null;

        return new ParsedCertificate(rawId, rawId == null ? null : normalizeId(rawId), participationAt, category);
    }

    /**
     * Normalizes the ID for comparison: only A-Z and 0-9, with O→0 and I→1.
     * This way the same certificate produces the same hash even if the OCR confuses similar letters and digits.
     */
    public static String normalizeId(String id) {
        return id.toUpperCase(Locale.ROOT)
                .replaceAll("[^0-9A-Z]", "")
                .replace('O', '0')
                .replace('I', '1');
    }
}
