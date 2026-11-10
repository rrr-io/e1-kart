package com.rrriooo.e1kart.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.rrriooo.e1kart.service.PixelImage.Filter;

/**
 * Layout analysis of a Mnet Plus voting certificate, ported from the collab verifier
 * (e1-social-race, collab.py) so the game judges certificates exactly like it:
 * <ul>
 * <li>an exported certificate (930×1410 proportions) is used as it is;</li>
 * <li>a phone screenshot is cut down to the certificate card: the large tinted area with the certificate
 * proportions, or, when the card is drawn plain white, the frame worked out from the row of three thumbnails;</li>
 * <li>each thumbnail becomes a 24×24 RGB vector (zero mean, unit length) compared by correlation;
 * thumbnails drawn a little off (other devices, screenshots) are found by a small search over position and size.</li>
 * </ul>
 * Pure functions, no Spring.
 */
public final class CertificateImage {

    private CertificateImage() {
    }

    /** Mnet Plus certificate width / height. */
    public static final double RATIO = 930.0 / 1410.0;
    /** The three thumbnails, as fractions of the certificate (measured on a 930×1410 export). */
    static final double[][] THUMB_SLOTS = {
            {81 / 930.0, 443 / 1410.0, 321 / 930.0, 683 / 1410.0},
            {345 / 930.0, 443 / 1410.0, 585 / 930.0, 683 / 1410.0},
            {609 / 930.0, 443 / 1410.0, 849 / 930.0, 683 / 1410.0}};
    /** The whole "No. &lt;ID&gt;" line, with some margin. */
    static final double[] ID_BOX = {0.04, 0.903, 0.66, 0.959};
    /** Screenshot frame edges relative to the detected card height. */
    static final double SHOT_TOP = -0.0055, SHOT_BOTTOM = 0.001;
    /** Certificate cards narrower than this are too small to trust the OCR of the ID. */
    public static final int MIN_CARD_WIDTH = 300;

    /** The certificate, and whether it was cut out of a phone screenshot. */
    public record Card(PixelImage image, boolean screenshot) {
    }

    /** Photos far larger than a phone screenshot are scaled down first, to keep memory low on the small server. */
    public static PixelImage limitSize(PixelImage im, long maxPixels) {
        long px = (long) im.width * im.height;
        if (px <= maxPixels) {
            return im;
        }
        double k = Math.sqrt((double) maxPixels / px);
        return im.resize(Math.max(1, (int) (im.width * k)), Math.max(1, (int) (im.height * k)), Filter.LANCZOS);
    }

    public static boolean layoutOk(PixelImage im) {
        return Math.abs((double) im.width / im.height / RATIO - 1) < 0.08;
    }

    /** A phone screenshot is cut down to the certificate card; anything else is returned as is. */
    public static Card normalise(PixelImage im) {
        if (layoutOk(im)) {
            return new Card(im, false);
        }
        int[] box = findCard(im);
        if (box == null) {
            box = findByThumbnails(im);
            if (box == null) {
                return new Card(im, false);
            }
            PixelImage page = PixelImage.blank(box[2] - box[0], box[3] - box[1], 3, 255);
            page.paste(im, -box[0], -box[1]); // white where the box reaches outside the image
            return new Card(page, true);
        }
        int height = box[3] - box[1];
        int top = Math.max(0, PixelImage.pyRound(box[1] + SHOT_TOP * height));
        int bottom = Math.min(im.height, PixelImage.pyRound(box[3] + SHOT_BOTTOM * height));
        double centre = (box[0] + box[2]) / 2.0, width = (bottom - top) * RATIO;
        int left = Math.max(0, PixelImage.pyRound(centre - width / 2));
        int right = Math.min(im.width, PixelImage.pyRound(centre + width / 2));
        return new Card(im.crop(left, top, right, bottom), true);
    }

    // ------------------------------------------------------------------ thumbnails

    /** The thumbnail of `slot` as a normalised vector, moved by (dx, dy) fractions of the image. */
    public static double[] slotVector(PixelImage im, int slot, double dx, double dy) {
        double[] b = THUMB_SLOTS[slot];
        double mx = (b[2] - b[0]) * 0.1, my = (b[3] - b[1]) * 0.1; // trims the rounded corners
        return vector(im.cropFraction(b[0] + mx + dx, b[1] + my + dy, b[2] - mx + dx, b[3] - my + dy));
    }

    /** Like slotVector, for a thumbnail `sx` times as wide and `sy` times as tall as the standard slot, moved by (dx, dy). */
    static double[] scaledVector(PixelImage im, int slot, double sx, double sy, double dx, double dy) {
        double[] b = THUMB_SLOTS[slot];
        double cx = (b[0] + b[2]) / 2 + dx, cy = (b[1] + b[3]) / 2 + dy;
        double hw = (b[2] - b[0]) * sx * 0.4, hh = (b[3] - b[1]) * sy * 0.4;
        return vector(im.cropFraction(cx - hw, cy - hh, cx + hw, cy + hh));
    }

    private static double[] vector(PixelImage piece) {
        if (piece.width == 0 || piece.height == 0) {
            return new double[24 * 24 * 3];
        }
        PixelImage small = piece.resize(24, 24, Filter.LANCZOS);
        double[] v = new double[small.data.length];
        double mean = 0;
        for (int i = 0; i < v.length; i++) {
            v[i] = small.data[i];
            mean += v[i];
        }
        mean /= v.length;
        double norm = 0;
        for (int i = 0; i < v.length; i++) {
            v[i] -= mean;
            norm += v[i] * v[i];
        }
        norm = Math.sqrt(norm);
        if (norm == 0) {
            norm = 1.0;
        }
        for (int i = 0; i < v.length; i++) {
            v[i] /= norm;
        }
        return v;
    }

    public static double correlation(double[] a, double[] b) {
        double s = 0;
        int n = Math.min(a.length, b.length);
        for (int i = 0; i < n; i++) {
            s += a[i] * b[i];
        }
        return s;
    }

    /**
     * Best similarity of a thumbnail with `target` when its position and size differ from the standard layout.
     * A coarse search over size and position is refined by a few rounds of small moves.
     */
    static double align(PixelImage im, int slot, double[] target, double stop) {
        record Seed(double value, double[] p) {
        }
        List<Seed> seeds = new ArrayList<>();
        for (double sx : new double[] {0.9, 0.96, 1.02, 1.08, 1.14}) {
            for (double dx : new double[] {-0.03, -0.015, 0.0, 0.015, 0.03}) {
                for (double dy : new double[] {-0.02, 0.0, 0.02}) {
                    double[] p = {sx, 1.0, dx, dy};
                    seeds.add(new Seed(correlation(scaledVector(im, slot, p[0], p[1], p[2], p[3]), target), p));
                }
            }
        }
        // Python's sorted(..., reverse=True) on (value, point) tuples: ties broken by the point, descending.
        seeds.sort((a, b) -> {
            int c = Double.compare(b.value, a.value);
            for (int i = 0; c == 0 && i < 4; i++) {
                c = Double.compare(b.p[i], a.p[i]);
            }
            return c;
        });
        double best = -1.0;
        for (Seed seed : seeds.subList(0, Math.min(2, seeds.size()))) {
            double value = seed.value;
            double[] point = seed.p.clone();
            double[] step = {0.03, 0.03, 0.01, 0.01};
            while (step[2] > 0.0015 && value < stop) {
                boolean moved = false;
                for (int i = 0; i < 4; i++) {
                    for (int sign : new int[] {-1, 1}) {
                        double[] c = point.clone();
                        c[i] += sign * step[i];
                        double got = correlation(scaledVector(im, slot, c[0], c[1], c[2], c[3]), target);
                        if (got > value) {
                            value = got;
                            point = c;
                            moved = true;
                        }
                    }
                }
                if (!moved) {
                    for (int i = 0; i < 4; i++) {
                        step[i] /= 2;
                    }
                }
            }
            best = Math.max(best, value);
            if (best >= stop) {
                break;
            }
        }
        return best;
    }

    // ------------------------------------------------------------------ finding the card in a screenshot

    /** (start, end) of the stretches where fractions >= minimum, bridging gaps of up to `gap` entries. */
    static List<int[]> runs(double[] fractions, double minimum, int gap) {
        List<int[]> found = new ArrayList<>();
        Integer start = null;
        int last = 0, missed = 0;
        for (int i = 0; i < fractions.length + gap + 1; i++) {
            double v = i < fractions.length ? fractions[i] : 0;
            if (v >= minimum) {
                if (start == null) {
                    start = i;
                }
                last = i;
                missed = 0;
            } else if (start != null) {
                missed++;
                if (missed > gap) {
                    found.add(new int[] {start, last + 1});
                    start = null;
                }
            }
        }
        return found;
    }

    private static PixelImage shrinkForSearch(PixelImage im) {
        double scale = Math.min(1.0, 540.0 / im.width);
        return im.resize(Math.max(1, PixelImage.pyRound(im.width * scale)), Math.max(1, PixelImage.pyRound(im.height * scale)), Filter.BOX);
    }

    /**
     * Box {x0, y0, x1, y1} of the certificate card inside a phone screenshot, or null. The card is the only
     * large tinted (non-white, non-grey) area with the certificate proportions; the status bar, ad banners
     * and buttons are white or grey.
     */
    public static int[] findCard(PixelImage im) {
        double scale = Math.min(1.0, 540.0 / im.width);
        PixelImage small = shrinkForSearch(im);
        PixelImage mask = small.saturationAndValue()[0].threshold(v -> v > 10);
        int w = mask.width, h = mask.height;
        double[] rows = mask.resize(1, h, Filter.BOX).fractions();
        // The card has pale stretches that need bridging, but an ad banner can sit just a few white rows above or
        // below it: so every chain of tightly separated stretches is tried too, not only the widely bridged ones.
        List<int[]> tight = runs(rows, 0.25, 2);
        Set<List<Integer>> bands = new LinkedHashSet<>();
        for (int[] r : runs(rows, 0.25, Math.max(2, h / 40))) {
            bands.add(List.of(r[0], r[1]));
        }
        for (int i = 0; i < tight.size(); i++) {
            for (int j = i; j < Math.min(tight.size(), i + 12); j++) {
                bands.add(List.of(tight.get(i)[0], tight.get(j)[1]));
            }
        }
        List<List<Integer>> sorted = new ArrayList<>(bands);
        sorted.sort((a, b) -> a.get(0).equals(b.get(0)) ? Integer.compare(a.get(1), b.get(1)) : Integer.compare(a.get(0), b.get(0)));
        long bestArea = -1;
        int[] best = null;
        for (List<Integer> band : sorted) {
            int y0 = band.get(0), y1 = band.get(1);
            if (y1 - y0 < h * 0.15) {
                continue;
            }
            PixelImage strip = mask.crop(0, y0, w, y1);
            for (int[] col : runs(strip.resize(w, 1, Filter.BOX).fractions(), 0.4, Math.max(2, w / 60))) {
                int x0 = col[0], x1 = col[1];
                if (x1 - x0 < w * 0.4 || Math.abs((double) (x1 - x0) / (y1 - y0) / RATIO - 1) > 0.04) {
                    continue;
                }
                double[] inside = mask.crop(x0, y0, x1, y1).resize(1, y1 - y0, Filter.BOX).fractions();
                double[] blank = new double[inside.length];
                for (int i = 0; i < inside.length; i++) {
                    blank[i] = 1 - inside[i];
                }
                int longestBlank = 0;
                for (int[] r : runs(blank, 0.9, 0)) {
                    longestBlank = Math.max(longestBlank, r[1] - r[0]);
                }
                if (longestBlank > (y1 - y0) * 0.03) {
                    continue; // a blank stretch inside: an ad banner and part of the card, not the card
                }
                long area = (long) (x1 - x0) * (y1 - y0);
                if (best == null || area > bestArea) {
                    bestArea = area;
                    best = new int[] {x0, y0, x1, y1};
                }
            }
        }
        if (best == null) {
            return null;
        }
        int[] out = new int[4];
        for (int i = 0; i < 4; i++) {
            out[i] = PixelImage.pyRound(best[i] / scale);
        }
        return out;
    }

    /** The three thumbnail-wide stretches of a row or column profile, or null. */
    static List<int[]> threeRuns(double[] values, int w) {
        List<int[]> found = new ArrayList<>();
        for (int[] r : runs(values, 0.5, Math.max(2, w / 80))) {
            if (r[1] - r[0] >= w * 0.12) {
                found.add(r);
            }
        }
        if (found.size() != 3) {
            return null;
        }
        int minW = Integer.MAX_VALUE, maxW = 0;
        for (int[] r : found) {
            minW = Math.min(minW, r[1] - r[0]);
            maxW = Math.max(maxW, r[1] - r[0]);
        }
        int g1 = found.get(1)[0] - found.get(0)[1], g2 = found.get(2)[0] - found.get(1)[1];
        if (maxW > minW * 1.15 || Math.min(g1, g2) <= 0 || Math.max(g1, g2) > minW * 0.25) {
            return null;
        }
        return found;
    }

    /**
     * Box of the certificate (in the export frame) worked out from its row of three thumbnails, or null.
     * For screenshots where the card has no tinted background (some app versions draw it plain white).
     * The box can reach outside the image.
     */
    public static int[] findByThumbnails(PixelImage im) {
        double scale = Math.min(1.0, 540.0 / im.width);
        PixelImage small = shrinkForSearch(im);
        int w = small.width, h = small.height;
        PixelImage[] sv = small.saturationAndValue();
        PixelImage ink = sv[0].threshold(v -> v > 25).lighter(sv[1].threshold(v -> v < 215));
        List<Integer> rows = new ArrayList<>();
        double[] row = new double[w];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                row[x] = ink.get(x, y, 0) / 255.0;
            }
            if (threeRuns(row, w) != null) {
                rows.add(y);
            }
        }
        if (rows.isEmpty()) {
            return null;
        }
        // the longest stretch of such rows is the thumbnail row
        int bestStart = 0, bestEnd = 0, start = rows.get(0);
        for (int i = 0; i < rows.size(); i++) {
            int a = rows.get(i);
            Integer b = i + 1 < rows.size() ? rows.get(i + 1) : null;
            if (b == null || b - a > Math.max(3, w / 40)) {
                if (a + 1 - start > bestEnd - bestStart) {
                    bestStart = start;
                    bestEnd = a + 1;
                }
                if (b != null) {
                    start = b;
                }
            }
        }
        int y0 = bestStart, y1 = bestEnd;
        List<int[]> cols = threeRuns(ink.crop(0, y0, w, y1).resize(w, 1, Filter.BOX).fractions(), w);
        if (cols == null) {
            return null;
        }
        int left = cols.get(0)[0], right = cols.get(2)[1];
        double width = (right - left) / (THUMB_SLOTS[2][2] - THUMB_SLOTS[0][0]);
        if (y1 - y0 < (cols.get(0)[1] - cols.get(0)[0]) * 0.4) {
            return null; // not tall enough to be the thumbnails
        }
        double height = width / RATIO;
        double x0 = left - THUMB_SLOTS[0][0] * width;
        double top = (y0 + y1) / 2.0 - (THUMB_SLOTS[0][1] + THUMB_SLOTS[0][3]) / 2 * height;
        double[] box = {x0, top, x0 + width, top + height};
        int[] out = new int[4];
        for (int i = 0; i < 4; i++) {
            out[i] = PixelImage.pyRound(box[i] / scale);
        }
        return out;
    }

    // ------------------------------------------------------------------ the ID line

    /**
     * Box (fractions) of the last line of text in the bottom part of the card, or null. Used when the ID is not at
     * the standard place: some app versions draw the card without its logo and with other spacing.
     */
    static double[] idLine(PixelImage im) {
        PixelImage part = im.cropFraction(0.04, 0.80, 0.66, 0.99).gray();
        PixelImage small = part.resize(Math.max(1, part.width / 2), Math.max(1, part.height), Filter.BOX).threshold(v -> v < 170);
        double[] rows = small.resize(1, small.height, Filter.BOX).fractions();
        List<int[]> lines = new ArrayList<>();
        for (int[] r : runs(rows, 0.02, 1)) {
            if (r[1] - r[0] >= 4) {
                lines.add(r);
            }
        }
        if (lines.isEmpty()) {
            return null;
        }
        int[] last = lines.get(lines.size() - 1);
        double pad = (last[1] - last[0]) * 0.6;
        return new double[] {0.04, 0.80 + (last[0] - pad) / im.height, 0.66, 0.80 + (last[1] + pad) / im.height};
    }
}
