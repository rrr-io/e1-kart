package com.rrriooo.e1kart.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

/**
 * A small 8-bit image (RGB or grayscale) with the few operations the certificate checks need.
 * <p>
 * The operations reproduce Pillow's arithmetic (resampling with the same filters and fixed-point
 * rounding, grayscale and HSV conversions, Python's round-half-to-even): the image checks are a port
 * of the collab verifier (e1-social-race, collab.py), and its similarity thresholds were tuned on
 * vectors computed by Pillow. Reference vectors exported from the verifier can be used as they are.
 */
public final class PixelImage {

    public final int width;
    public final int height;
    /** 3 = RGB, 1 = grayscale. */
    public final int channels;
    /** Row-major samples, 0..255, interleaved per pixel. */
    final int[] data;

    PixelImage(int width, int height, int channels, int[] data) {
        this.width = width;
        this.height = height;
        this.channels = channels;
        this.data = data;
    }

    static PixelImage blank(int width, int height, int channels, int value) {
        int[] d = new int[width * height * channels];
        java.util.Arrays.fill(d, value);
        return new PixelImage(width, height, channels, d);
    }

    /** Decodes PNG/JPEG bytes as RGB; transparent pixels are flattened on white. Null if the bytes are not an image. */
    public static PixelImage decode(byte[] bytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            return img == null ? null : fromBuffered(img);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    public static PixelImage fromBuffered(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        int[] argb = img.getRGB(0, 0, w, h, null, 0, w);
        int[] d = new int[w * h * 3];
        boolean alpha = img.getColorModel().hasAlpha();
        for (int i = 0; i < w * h; i++) {
            int p = argb[i];
            int r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
            if (alpha) {
                int a = (p >>> 24);
                r = (r * a + 255 * (255 - a) + 127) / 255;
                g = (g * a + 255 * (255 - a) + 127) / 255;
                b = (b * a + 255 * (255 - a) + 127) / 255;
            }
            d[i * 3] = r;
            d[i * 3 + 1] = g;
            d[i * 3 + 2] = b;
        }
        return new PixelImage(w, h, 3, d);
    }

    public BufferedImage toBuffered() {
        BufferedImage out = new BufferedImage(width, height, channels == 1 ? BufferedImage.TYPE_BYTE_GRAY : BufferedImage.TYPE_INT_RGB);
        if (channels == 1) {
            byte[] px = new byte[width * height];
            for (int i = 0; i < px.length; i++) {
                px[i] = (byte) data[i];
            }
            out.getRaster().setDataElements(0, 0, width, height, px);
        } else {
            int[] rgb = new int[width * height];
            for (int i = 0; i < rgb.length; i++) {
                rgb[i] = (data[i * 3] << 16) | (data[i * 3 + 1] << 8) | data[i * 3 + 2];
            }
            out.setRGB(0, 0, width, height, rgb, 0, width);
        }
        return out;
    }

    int get(int x, int y, int c) {
        return data[(y * width + x) * channels + c];
    }

    /** Python's round(): halves go to the even neighbour. */
    static int pyRound(double v) {
        return (int) Math.rint(v);
    }

    /** Pillow's crop: integer box, pixels outside the image are black (0). */
    public PixelImage crop(int x0, int y0, int x1, int y1) {
        int w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
        int[] d = new int[w * h * channels];
        for (int y = 0; y < h; y++) {
            int sy = y + y0;
            if (sy < 0 || sy >= height) {
                continue;
            }
            for (int x = 0; x < w; x++) {
                int sx = x + x0;
                if (sx < 0 || sx >= width) {
                    continue;
                }
                System.arraycopy(data, (sy * width + sx) * channels, d, (y * w + x) * channels, channels);
            }
        }
        return new PixelImage(w, h, channels, d);
    }

    /** Crop by fractions of the size, rounded like the verifier's crop(). */
    public PixelImage cropFraction(double fx0, double fy0, double fx1, double fy1) {
        return crop(pyRound(fx0 * width), pyRound(fy0 * height), pyRound(fx1 * width), pyRound(fy1 * height));
    }

    /** Pillow's convert('L'). */
    public PixelImage gray() {
        if (channels == 1) {
            return this;
        }
        int[] d = new int[width * height];
        for (int i = 0; i < d.length; i++) {
            d[i] = (data[i * 3] * 19595 + data[i * 3 + 1] * 38470 + data[i * 3 + 2] * 7471 + 0x8000) >> 16;
        }
        return new PixelImage(width, height, 1, d);
    }

    /** Pillow's convert('HSV'): returns {saturation, value} planes. */
    public PixelImage[] saturationAndValue() {
        int n = width * height;
        int[] s = new int[n], v = new int[n];
        for (int i = 0; i < n; i++) {
            int r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
            int max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b));
            v[i] = max;
            s[i] = max == min ? 0 : Math.min(255, (int) ((float) (max - min) / (float) max * 255.0));
        }
        return new PixelImage[] {new PixelImage(width, height, 1, s), new PixelImage(width, height, 1, v)};
    }

    /** point(): 255 where the test holds, 0 elsewhere (grayscale). */
    public PixelImage threshold(java.util.function.IntPredicate on) {
        int[] d = new int[data.length];
        for (int i = 0; i < d.length; i++) {
            d[i] = on.test(data[i]) ? 255 : 0;
        }
        return new PixelImage(width, height, channels, d);
    }

    /** ImageChops.lighter. */
    public PixelImage lighter(PixelImage o) {
        int[] d = new int[data.length];
        for (int i = 0; i < d.length; i++) {
            d[i] = Math.max(data[i], o.data[i]);
        }
        return new PixelImage(width, height, channels, d);
    }

    /** ImageOps.autocontrast with no cutoff (grayscale). */
    public PixelImage autocontrast() {
        int lo = 255, hi = 0;
        for (int v : data) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
        }
        if (hi <= lo) {
            return this;
        }
        double scale = 255.0 / (hi - lo), offset = -lo * scale;
        int[] lut = new int[256];
        for (int i = 0; i < 256; i++) {
            lut[i] = Math.max(0, Math.min(255, (int) (i * scale + offset)));
        }
        int[] d = new int[data.length];
        for (int i = 0; i < d.length; i++) {
            d[i] = lut[data[i]];
        }
        return new PixelImage(width, height, channels, d);
    }

    /** ImageOps.expand: a border of `pad` pixels of `fill`. */
    public PixelImage expand(int pad, int fill) {
        PixelImage out = blank(width + pad * 2, height + pad * 2, channels, fill);
        out.paste(this, pad, pad);
        return out;
    }

    /** Pastes `src` with its top-left corner at (x0, y0); parts outside are dropped. */
    public void paste(PixelImage src, int x0, int y0) {
        for (int y = 0; y < src.height; y++) {
            int ty = y + y0;
            if (ty < 0 || ty >= height) {
                continue;
            }
            for (int x = 0; x < src.width; x++) {
                int tx = x + x0;
                if (tx >= 0 && tx < width) {
                    System.arraycopy(src.data, (y * src.width + x) * channels, data, (ty * width + tx) * channels, channels);
                }
            }
        }
    }

    // ------------------------------------------------------------------ resampling (Pillow's Resample.c)

    public enum Filter { BOX, LANCZOS }

    private static final int PRECISION_BITS = 32 - 8 - 2;

    private static double filter(Filter f, double x) {
        if (f == Filter.BOX) {
            return x > -0.5 && x <= 0.5 ? 1.0 : 0.0;
        }
        if (-3.0 <= x && x < 3.0) {
            return sinc(x) * sinc(x / 3);
        }
        return 0.0;
    }

    private static double sinc(double x) {
        if (x == 0.0) {
            return 1.0;
        }
        x *= Math.PI;
        return Math.sin(x) / x;
    }

    private record Coeffs(int[] bounds, int[] k, int ksize) {
    }

    private static Coeffs coeffs(int inSize, int outSize, Filter f) {
        double scale = (double) inSize / outSize;
        double filterscale = Math.max(1.0, scale);
        double support = (f == Filter.BOX ? 0.5 : 3.0) * filterscale;
        int ksize = (int) Math.ceil(support) * 2 + 1;
        int[] bounds = new int[outSize * 2];
        int[] k = new int[outSize * ksize];
        double[] pre = new double[ksize];
        for (int xx = 0; xx < outSize; xx++) {
            double center = (xx + 0.5) * scale;
            double ss = 1.0 / filterscale;
            int xmin = (int) (center - support + 0.5);
            if (xmin < 0) {
                xmin = 0;
            }
            int xmax = (int) (center + support + 0.5);
            if (xmax > inSize) {
                xmax = inSize;
            }
            xmax -= xmin;
            double ww = 0.0;
            for (int x = 0; x < xmax; x++) {
                double w = filter(f, (x + xmin - center + 0.5) * ss);
                pre[x] = w;
                ww += w;
            }
            for (int x = 0; x < xmax; x++) {
                double v = ww != 0.0 ? pre[x] / ww : pre[x];
                double scaled = v * (1 << PRECISION_BITS);
                k[xx * ksize + x] = (int) (v < 0 ? (long) (-0.5 + scaled) : (long) (0.5 + scaled));
            }
            bounds[xx * 2] = xmin;
            bounds[xx * 2 + 1] = xmax;
        }
        return new Coeffs(bounds, k, ksize);
    }

    private static int clip8(long v) {
        long r = v >> PRECISION_BITS;
        return r < 0 ? 0 : r > 255 ? 255 : (int) r;
    }

    /** Pillow's Image.resize(size, filter): horizontal pass, then vertical, 8-bit in between. */
    public PixelImage resize(int w, int h, Filter f) {
        if (w == width && h == height) {
            return this;
        }
        PixelImage cur = this;
        if (w != width) {
            Coeffs c = coeffs(width, w, f);
            int[] d = new int[w * height * channels];
            for (int y = 0; y < height; y++) {
                for (int xx = 0; xx < w; xx++) {
                    int xmin = c.bounds[xx * 2], xmax = c.bounds[xx * 2 + 1];
                    for (int ch = 0; ch < channels; ch++) {
                        long ss = 1L << (PRECISION_BITS - 1);
                        for (int x = 0; x < xmax; x++) {
                            ss += (long) cur.data[(y * width + x + xmin) * channels + ch] * c.k[xx * c.ksize + x];
                        }
                        d[(y * w + xx) * channels + ch] = clip8(ss);
                    }
                }
            }
            cur = new PixelImage(w, height, channels, d);
        }
        if (h != height) {
            Coeffs c = coeffs(height, h, f);
            int[] d = new int[w * h * channels];
            for (int yy = 0; yy < h; yy++) {
                int ymin = c.bounds[yy * 2], ymax = c.bounds[yy * 2 + 1];
                for (int x = 0; x < w; x++) {
                    for (int ch = 0; ch < channels; ch++) {
                        long ss = 1L << (PRECISION_BITS - 1);
                        for (int y = 0; y < ymax; y++) {
                            ss += (long) cur.data[((y + ymin) * w + x) * channels + ch] * c.k[yy * c.ksize + y];
                        }
                        d[(yy * w + x) * channels + ch] = clip8(ss);
                    }
                }
            }
            cur = new PixelImage(w, h, channels, d);
        }
        return cur;
    }

    /** Fractions (0..1) of a one-pixel-wide or one-pixel-tall profile, like `[v / 255 for v in im.tobytes()]`. */
    double[] fractions() {
        double[] out = new double[data.length];
        for (int i = 0; i < out.length; i++) {
            out[i] = data[i] / 255.0;
        }
        return out;
    }
}
