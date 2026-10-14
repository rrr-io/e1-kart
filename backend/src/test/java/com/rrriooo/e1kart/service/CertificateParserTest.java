package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.rrriooo.e1kart.dto.ParsedCertificate;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;

class CertificateParserTest {

    private final CertificateParser parser = new CertificateParser();

    /** Text produced by tesseract on a real certificate screenshot. */
    private static String realOcr() throws IOException {
        try (InputStream in = CertificateParserTest.class.getResourceAsStream("/certificate-ocr.txt")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void parsesRealCertificate() throws IOException {
        ParsedCertificate c = parser.parse(realOcr());
        assertEquals("61013P5EM74JDMJZ", c.rawId());
        assertEquals("61013P5EM74JDMJZ", c.normalizedId());
        assertEquals(LocalDateTime.of(2026, 10, 13, 21, 42), c.participationAt());
        assertEquals("FANS' CHOICE CATEGORY 1ST VOTE", c.category());
    }

    @Test
    void toleratesOcrConfusions() {
        String text = "VOTING CERTIFICATE\n2026 MAMA AWARDS\nFANS' CHOICE Category 1st\nVOTE\n"
                + "Participation Date 2026.10.13 21:42\nissued by Mnet Plus.\nN0. 61O13P5EM74JDMJZ";
        ParsedCertificate c = parser.parse(text);
        assertEquals("61O13P5EM74JDMJZ", c.rawId());
        // O read in place of 0: same normalized ID, so the same hash.
        assertEquals("61013P5EM74JDMJZ", c.normalizedId());
    }

    @Test
    void rejectsRandomImages() {
        ApiException e = assertThrows(ApiException.class, () -> parser.parse("Screenshot of a cat\nNo. 61013P5EM74JDMJZ"));
        assertEquals(ErrorCode.NOT_A_CERTIFICATE, e.code());
    }

    @Test
    void rejectsMissingId() {
        ApiException e = assertThrows(ApiException.class, () -> parser.parse(
                "VOTING CERTIFICATE 2026 MAMA AWARDS Participation Date 2026.10.13 21:42 issued by Mnet Plus."));
        assertEquals(ErrorCode.ID_NOT_FOUND, e.code());
    }

    @Test
    void rejectsMissingDate() {
        ApiException e = assertThrows(ApiException.class, () -> parser.parse(
                "VOTING CERTIFICATE 2026 MAMA AWARDS issued by Mnet Plus. No. 61013P5EM74JDMJZ"));
        assertEquals(ErrorCode.DATE_NOT_FOUND, e.code());
    }
}
