package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;

import org.junit.jupiter.api.Test;

/**
 * The layout checks of the collab verifier on the same synthetic images (see resources/certificates/README.md).
 * Expected boxes and similarities are the verifier's own results on these files.
 */
class CertificateImageTest {

    static byte[] bytes(String name) throws IOException {
        try (InputStream in = CertificateImageTest.class.getResourceAsStream("/certificates/" + name + ".png")) {
            return in.readAllBytes();
        }
    }

    static PixelImage image(String name) throws IOException {
        return PixelImage.decode(bytes(name));
    }

    @Test
    void certificatesPassThroughAndScreenshotsAreCutToTheCard() throws IOException {
        CertificateImage.Card cert = CertificateImage.normalise(image("cert_enhypen"));
        assertFalse(cert.screenshot());
        assertEquals(930, cert.image().width);

        CertificateImage.Card shot = CertificateImage.normalise(image("shot_enhypen"));
        assertTrue(shot.screenshot());
        assertEquals(812, shot.image().width);
        assertEquals(1232, shot.image().height);
    }

    @Test
    void cardIsLocatedEvenWithAnAdJustAboveIt() throws IOException {
        assertArrayEquals(new int[] {138, 650, 942, 1874}, CertificateImage.findCard(image("shot_enhypen")));
        assertArrayEquals(new int[] {138, 610, 942, 1834}, CertificateImage.findCard(image("shot_ad_above")));
        assertNull(CertificateImage.findCard(PixelImage.blank(1080, 2280, 3, 255)));
    }

    @Test
    void plainWhiteCardIsFoundFromItsThumbnails() throws IOException {
        PixelImage im = image("shot_white_card");
        assertNull(CertificateImage.findCard(im));
        assertArrayEquals(new int[] {133, 642, 947, 1876}, CertificateImage.findByThumbnails(im));
        assertNull(CertificateImage.findByThumbnails(PixelImage.blank(1080, 2280, 3, 255)));
    }

    @Test
    void vectorsMatchTheVerifiers() throws IOException {
        double[] java = EnhypenMatcher.referenceFrom(bytes("cert_enhypen"));
        double[] verifier = EnhypenMatcherTest.verifierReference();
        assertTrue(CertificateImage.correlation(java, verifier) > 0.9999);
        double shot = CertificateImage.correlation(CertificateImage.slotVector(CertificateImage.normalise(image("shot_enhypen")).image(), 2, 0, 0), verifier);
        assertEquals(0.99926, shot, 0.0005);
    }
}
