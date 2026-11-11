package com.rrriooo.e1kart.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.rrriooo.e1kart.config.E1KartProperties;

/**
 * Checks that a FAVORITE MCD STAGE certificate shows the ENHYPEN stage, very leniently: its middle photo is compared
 * with the photos of ENHYPEN MCD certificates in {@code e1kart.mcd-refs-dir} (images of the whole certificate, an
 * export or a phone screenshot). It is refused only when the card has the standard layout and the photo is clearly
 * different from every reference; anything unsure is accepted.
 */
@Service
public class McdMatcher {

    private static final Logger log = LoggerFactory.getLogger(McdMatcher.class);

    /** Similarity at or above: the ENHYPEN stage photo. */
    public static final double T_OK = 0.80;
    /** Similarity below, on a standard card: clearly another stage. Low on purpose: the check is lenient. */
    public static final double T_LOW = 0.45;
    private static final double[][] NO_SHIFT = {{0, 0}};
    private static final double[][] SHOT_SHIFTS = shifts();

    public enum Verdict { ENHYPEN, NOT_ENHYPEN, UNCLEAR }

    public record Result(Verdict verdict, double similarity) {
    }

    private final List<double[]> refs = new ArrayList<>();

    @Autowired
    public McdMatcher(E1KartProperties props) {
        String dir = props.mcdRefsDir();
        if (dir == null || dir.isBlank()) {
            log.warn("e1kart.mcd-refs-dir is not set: MCD certificates are NOT checked for ENHYPEN");
            return;
        }
        load(Path.of(dir));
    }

    /** For tests: the given references. */
    public McdMatcher(List<double[]> refs) {
        this.refs.addAll(refs);
    }

    public boolean enabled() {
        return !refs.isEmpty();
    }

    private void load(Path dir) {
        if (!Files.isDirectory(dir)) {
            log.warn("MCD references folder {} not found: MCD certificates are NOT checked for ENHYPEN", dir);
            return;
        }
        try (Stream<Path> files = Files.list(dir)) {
            for (Path f : files.sorted().toList()) {
                String name = f.getFileName().toString().toLowerCase(Locale.ROOT);
                if (!(name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"))) {
                    continue;
                }
                try {
                    refs.add(referenceFrom(Files.readAllBytes(f)));
                    log.info("MCD reference: {}", f.getFileName());
                } catch (IOException | IllegalArgumentException e) {
                    log.error("MCD reference {} skipped: {}", f.getFileName(), e.getMessage());
                }
            }
        } catch (IOException e) {
            log.error("Cannot read the MCD references folder {}", dir, e);
        }
        if (refs.isEmpty()) {
            log.warn("No MCD references in {}: MCD certificates are NOT checked for ENHYPEN", dir);
        }
    }

    /** The reference vector of an MCD certificate image: its middle photo. */
    public static double[] referenceFrom(byte[] image) {
        PixelImage im = PixelImage.decode(image);
        if (im == null) {
            throw new IllegalArgumentException("not an image");
        }
        PixelImage card = CertificateImage.normalise(im).image();
        if (!CertificateImage.layoutOk(card)) {
            throw new IllegalArgumentException("use a full, uncropped MCD certificate or a screenshot showing the whole card");
        }
        return CertificateImage.mcdVector(card, 0, 0);
    }

    /** Judges the photo of an already normalised MCD certificate card. */
    public Result check(CertificateImage.Card card) {
        PixelImage im = card.image();
        double best = -1.0;
        for (double[] s : card.screenshot() ? SHOT_SHIFTS : NO_SHIFT) {
            double[] v = CertificateImage.mcdVector(im, s[0], s[1]);
            for (double[] t : refs) {
                best = Math.max(best, CertificateImage.correlation(v, t));
            }
        }
        if (best >= T_OK) {
            return new Result(Verdict.ENHYPEN, best);
        }
        boolean trusted = CertificateImage.singleImageLayout(im);
        return new Result(trusted && best < T_LOW ? Verdict.NOT_ENHYPEN : Verdict.UNCLEAR, best);
    }

    private static double[][] shifts() {
        double[][] out = new double[49][];
        int i = 0;
        for (int dx = -3; dx <= 3; dx++) {
            for (int dy = -3; dy <= 3; dy++) {
                out[i++] = new double[] {dx * 0.004, dy * 0.004};
            }
        }
        return out;
    }
}
