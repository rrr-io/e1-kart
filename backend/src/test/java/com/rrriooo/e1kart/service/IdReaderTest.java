package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.rrriooo.e1kart.config.E1KartProperties;

/** Real OCR of the "No." line (skipped when tesseract is not installed), like the verifier's RealOCR tests. */
class IdReaderTest {

    private static boolean tesseract() {
        try {
            return new ProcessBuilder("tesseract", "--version").start().waitFor() == 0;
        } catch (IOException | InterruptedException e) {
            return false;
        }
    }

    private static String id(String name) throws IOException {
        E1KartProperties props = new E1KartProperties("x".repeat(32), true, 1, "Asia/Seoul", "tesseract", 20, 2, 6, List.of(), "", "", "", "Europe/Rome", "");
        IdReader reader = new IdReader(props, new OcrService(props));
        return IdVotes.consensus(reader.read(CertificateImage.normalise(CertificateImageTest.image(name)).image()));
    }

    @Test
    void readsTheWholeNoLine() throws IOException {
        assumeTrue(tesseract());
        assertEquals("61105JDXSVKA6VXC", id("id_cert"));
    }

    @Test
    void readsTheIdLineOfAScreenshot() throws IOException {
        assumeTrue(tesseract());
        assertEquals("61101HZSLUIHCBOR", id("id_shot"));
    }
}
