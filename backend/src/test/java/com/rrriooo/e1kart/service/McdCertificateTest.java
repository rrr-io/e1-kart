package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.rrriooo.e1kart.model.CertificateKind;

/** FAVORITE MCD STAGE certificates (Bloody Paradise): kind detection, ID date prefix, lenient ENHYPEN check. */
class McdCertificateTest {

    /** A synthetic 930×1410 card: light background, and either one framed photo in the middle (MCD) or three thumbnails. */
    static PixelImage card(boolean mcd, long seed) {
        PixelImage im = PixelImage.blank(930, 1410, 3, 238);
        Random r = new Random(seed);
        if (mcd) {
            fill(im, 305, 396, 624, 729, 20, 20, 20);
            noise(im, 305, 468, 624, 657, r);
        } else {
            for (int[] b : new int[][] {{81, 443, 321, 683}, {345, 443, 585, 683}, {609, 443, 849, 683}}) {
                noise(im, b[0], b[1], b[2], b[3], r);
            }
        }
        return im;
    }

    static void fill(PixelImage im, int x0, int y0, int x1, int y1, int cr, int cg, int cb) {
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int i = (y * im.width + x) * 3;
                im.data[i] = cr;
                im.data[i + 1] = cg;
                im.data[i + 2] = cb;
            }
        }
    }

    /** Blocky random "photo". */
    static void noise(PixelImage im, int x0, int y0, int x1, int y1, Random r) {
        for (int y = y0; y < y1; y += 20) {
            for (int x = x0; x < x1; x += 20) {
                fill(im, x, y, Math.min(x1, x + 20), Math.min(y1, y + 20), r.nextInt(256), r.nextInt(256), r.nextInt(256));
            }
        }
    }

    @Test
    void theTextNamesTheKind() {
        assertEquals(CertificateKind.MCD, CertificateParser.kindFromText("2026 MAMA AWARDS\nFAVORITE MCD STAGE with\nMnet Plus VOTE"));
        assertEquals(CertificateKind.MCD, CertificateParser.kindFromText("FAVORITE MC0 ST4GE with Mnet Plus VOTE"));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateParser.kindFromText("2026 MAMA AWARDS FANS' CHOICE Category 2nd VOTE"));
        assertNull(CertificateParser.kindFromText("VOTING CERTIFICATE"));
        assertNull(CertificateParser.kindFromText(null));
    }

    @Test
    void theIdPrefixIsCorrectedFromTheVoteDate() {
        LocalDateTime nov9 = LocalDateTime.of(2026, 11, 9, 23, 7);
        assertEquals("61109KKOJL9EYKSI", CertificateParser.fixDatePrefix("61109KKOJL9EYKSI", nov9));
        assertEquals("61109KKOJL9EYKSI", CertificateParser.fixDatePrefix("6II09KKOJL9EYKSI", nov9));
        assertEquals("61109KKOJL9EYKSI", CertificateParser.fixDatePrefix("G1I0SKKOJL9EYKSI", nov9));
        // Too far from the date: left as read.
        assertEquals("ABCDEKKOJL9EYKSI", CertificateParser.fixDatePrefix("ABCDEKKOJL9EYKSI", nov9));
        assertNull(CertificateParser.fixDatePrefix(null, nov9));
        assertEquals("61109KKOJL9EYKSI", CertificateParser.fixDatePrefix("61109KKOJL9EYKSI", null));
    }

    @Test
    void oneFramedPhotoIsTheMcdLayout() {
        assertTrue(CertificateImage.singleImageLayout(card(true, 1)));
        assertFalse(CertificateImage.singleImageLayout(card(false, 1)));
        assertFalse(CertificateImage.singleImageLayout(PixelImage.blank(1000, 1000, 3, 238)));
    }

    @Test
    void theKindComesFromTextThenLayoutThenTrack() {
        CertificateImage.Card mcd = new CertificateImage.Card(card(true, 2), false);
        CertificateImage.Card fans = new CertificateImage.Card(card(false, 2), false);
        CertificateImage.Card cropped = new CertificateImage.Card(PixelImage.blank(900, 400, 3, 238), false);
        assertEquals(CertificateKind.MCD, CertificateService.kindOf("FAVORITE MCD STAGE with Mnet Plus VOTE", fans, CertificateKind.FANS_CHOICE));
        assertEquals(CertificateKind.MCD, CertificateService.kindOf("", mcd, CertificateKind.FANS_CHOICE));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateService.kindOf("", fans, CertificateKind.MCD));
        assertEquals(CertificateKind.MCD, CertificateService.kindOf("", cropped, CertificateKind.MCD));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateService.kindOf("", cropped, CertificateKind.FANS_CHOICE));
    }

    @Test
    void theMcdCheckRefusesOnlyAClearlyDifferentStage() {
        PixelImage enhypen = card(true, 7);
        McdMatcher m = new McdMatcher(List.of(CertificateImage.mcdVector(enhypen, 0, 0)));
        assertEquals(McdMatcher.Verdict.ENHYPEN, m.check(new CertificateImage.Card(enhypen, false)).verdict());
        assertEquals(McdMatcher.Verdict.NOT_ENHYPEN, m.check(new CertificateImage.Card(card(true, 99), false)).verdict());
        // Not a standard MCD card: in doubt, accepted.
        assertEquals(McdMatcher.Verdict.UNCLEAR, m.check(new CertificateImage.Card(PixelImage.blank(900, 400, 3, 238), false)).verdict());
    }

    @Test
    void tracksMapToKinds() {
        assertEquals(CertificateKind.MCD, CertificateKind.forTrack("bloody"));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forTrack("space"));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forTrack(null));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.of(null));
        assertEquals(CertificateKind.MCD, CertificateKind.of("MCD"));
    }
}
