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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rrriooo.e1kart.config.E1KartProperties;

/**
 * Checks that the last image of the certificate is ENHYPEN, like the collab verifier (collab.py, analyse()):
 * the third thumbnail is compared with the ENHYPEN references; phone screenshots are tried at a few small
 * offsets, and a thumbnail drawn at another position or size is searched for before it is judged.
 * <p>
 * References live in the folder {@code e1kart.enhypen-refs-dir} and are loaded at startup:
 * <ul>
 * <li>certificate images (PNG/JPG, an export or a phone screenshot showing the whole card): their last image is the reference;</li>
 * <li>JSON files exported from the verifier ({@code [{"label": "...", "vec": [...]}, ...]} or a list of vectors).</li>
 * </ul>
 */
@Service
public class EnhypenMatcher {

    private static final Logger log = LoggerFactory.getLogger(EnhypenMatcher.class);

    /** Similarity at or above: the last image is ENHYPEN. */
    public static final double T_OK = 0.85;
    /** Similarity below (standard layout only): clearly not ENHYPEN. */
    public static final double T_LOW = 0.60;
    private static final double[][] NO_SHIFT = {{0, 0}};
    private static final double[][] SHOT_SHIFTS = shifts();

    public enum Verdict {
        /** The last image is ENHYPEN. */
        ENHYPEN,
        /** The last image is not ENHYPEN. */
        NOT_ENHYPEN,
        /** ENHYPEN is on the certificate, but not as the last image. */
        NOT_LAST,
        /** Standard layout, but the similarity is in the grey zone. */
        UNCLEAR,
        /** Not a standard certificate layout (cropped screenshot, card not found). */
        NON_STANDARD
    }

    public record Result(Verdict verdict, double similarity) {
    }

    private final List<double[]> refs = new ArrayList<>();

    @Autowired
    public EnhypenMatcher(E1KartProperties props) {
        String dir = props.enhypenRefsDir();
        if (dir == null || dir.isBlank()) {
            log.warn("e1kart.enhypen-refs-dir is not set: certificates are NOT checked for ENHYPEN");
            return;
        }
        load(Path.of(dir));
    }

    /** For tests: the given references. */
    public EnhypenMatcher(List<double[]> refs) {
        this.refs.addAll(refs);
    }

    public boolean enabled() {
        return !refs.isEmpty();
    }

    public int referenceCount() {
        return refs.size();
    }

    private void load(Path dir) {
        if (!Files.isDirectory(dir)) {
            log.warn("ENHYPEN references folder {} not found: certificates are NOT checked for ENHYPEN", dir);
            return;
        }
        try (Stream<Path> files = Files.list(dir)) {
            for (Path f : files.sorted().toList()) {
                String name = f.getFileName().toString().toLowerCase(Locale.ROOT);
                try {
                    if (name.endsWith(".json")) {
                        int before = refs.size();
                        JsonNode root = new ObjectMapper().readTree(f.toFile());
                        for (JsonNode item : root.isArray() ? root : List.of(root)) {
                            JsonNode vec = item.isArray() ? item : item.path("vec");
                            if (vec.isArray() && vec.size() == 24 * 24 * 3) {
                                double[] v = new double[vec.size()];
                                for (int i = 0; i < v.length; i++) {
                                    v[i] = vec.get(i).asDouble();
                                }
                                refs.add(v);
                            }
                        }
                        log.info("ENHYPEN references: {} vectors from {}", refs.size() - before, f.getFileName());
                    } else if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
                        refs.add(referenceFrom(Files.readAllBytes(f)));
                        log.info("ENHYPEN reference: {}", f.getFileName());
                    }
                } catch (IOException | IllegalArgumentException e) {
                    log.error("ENHYPEN reference {} skipped: {}", f.getFileName(), e.getMessage());
                }
            }
        } catch (IOException e) {
            log.error("Cannot read the ENHYPEN references folder {}", dir, e);
        }
        if (refs.isEmpty()) {
            log.warn("No ENHYPEN references in {}: certificates are NOT checked for ENHYPEN", dir);
        }
    }

    /** The reference vector of a certificate image: its last thumbnail. */
    public static double[] referenceFrom(byte[] image) {
        PixelImage im = PixelImage.decode(image);
        if (im == null) {
            throw new IllegalArgumentException("not an image");
        }
        PixelImage card = CertificateImage.normalise(im).image();
        if (!CertificateImage.layoutOk(card)) {
            throw new IllegalArgumentException("use a full, uncropped certificate or a screenshot showing the whole card");
        }
        return CertificateImage.slotVector(card, 2, 0, 0);
    }

    /** Judges the last image of an already normalised certificate card. */
    public Result check(CertificateImage.Card card) {
        PixelImage im = card.image();
        double[][] shifts = card.screenshot() ? SHOT_SHIFTS : NO_SHIFT;
        double last = match(im, 2, shifts);
        boolean trusted = CertificateImage.layoutOk(im);
        if (trusted && last < T_LOW) {
            double other = Math.max(match(im, 0, shifts), match(im, 1, shifts));
            return new Result(other >= T_OK ? Verdict.NOT_LAST : Verdict.NOT_ENHYPEN, last);
        }
        if (last < T_OK) {
            return new Result(trusted ? Verdict.UNCLEAR : Verdict.NON_STANDARD, last);
        }
        return new Result(Verdict.ENHYPEN, last);
    }

    /** Best similarity of one thumbnail with any reference; searched for when nothing matches at the standard position. */
    private double match(PixelImage im, int slot, double[][] shifts) {
        double best = -1.0;
        for (double[] s : shifts) {
            double[] v = CertificateImage.slotVector(im, slot, s[0], s[1]);
            for (double[] t : refs) {
                best = Math.max(best, CertificateImage.correlation(v, t));
            }
        }
        if (best < T_OK) {
            for (double[] t : refs.subList(0, Math.min(4, refs.size()))) {
                best = Math.max(best, CertificateImage.align(im, slot, t, 0.97));
            }
        }
        return best;
    }

    private static double[][] shifts() {
        double[][] out = new double[81][];
        int i = 0;
        for (int dx = -4; dx <= 4; dx++) {
            for (int dy = -4; dy <= 4; dy++) {
                out[i++] = new double[] {dx * 0.0025, dy * 0.0025};
            }
        }
        return out;
    }
}
