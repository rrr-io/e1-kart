package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rrriooo.e1kart.service.EnhypenMatcher.Verdict;

/** The verifier's ENHYPEN decisions (analyse() in collab.py) on the same images. */
class EnhypenMatcherTest {

    /** The reference exported by the verifier for cert_enhypen.png. */
    static double[] verifierReference() throws IOException {
        try (InputStream in = EnhypenMatcherTest.class.getResourceAsStream("/certificates/enhypen-refs.json")) {
            JsonNode vec = new ObjectMapper().readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8)).get(0).path("vec");
            double[] v = new double[vec.size()];
            for (int i = 0; i < v.length; i++) {
                v[i] = vec.get(i).asDouble();
            }
            return v;
        }
    }

    private static Verdict verdict(String name) throws IOException {
        EnhypenMatcher m = new EnhypenMatcher(List.of(verifierReference()));
        return m.check(CertificateImage.normalise(CertificateImageTest.image(name))).verdict();
    }

    @Test
    void enhypenCertificatesAndScreenshotsPass() throws IOException {
        for (String name : List.of("cert_enhypen", "shot_enhypen", "shot_ad_above", "shot_white_card", "shot_small_phone")) {
            assertEquals(Verdict.ENHYPEN, verdict(name), name);
        }
    }

    @Test
    void anotherLastImageIsRejected() throws IOException {
        assertEquals(Verdict.NOT_ENHYPEN, verdict("cert_other"));
        assertEquals(Verdict.NOT_ENHYPEN, verdict("shot_other"));
        assertEquals(Verdict.NOT_LAST, verdict("cert_enhypen_first"));
    }

    @Test
    void thumbnailsDrawnWiderOrMovedAreStillRecognised() throws IOException {
        assertEquals(Verdict.ENHYPEN, verdict("wide_enhypen"));
        assertEquals(Verdict.NOT_ENHYPEN, verdict("wide_other")); // a different image is not found by the search
    }

    @Test
    void aPageWithoutTheCardIsNotStandard() {
        EnhypenMatcher m = new EnhypenMatcher(List.of(new double[24 * 24 * 3]));
        assertEquals(Verdict.NON_STANDARD, m.check(CertificateImage.normalise(PixelImage.blank(1080, 2280, 3, 255))).verdict());
    }
}
