package com.rrriooo.e1kart.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;

/**
 * Reads the image's text with the Tesseract CLI (installed inside the container).
 * The image is decoded and rewritten as a grayscale PNG into a temp file,
 * passed to tesseract, and deleted right after: nothing stays on disk.
 */
@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    /** Width we resize the image to: enough for crisp text, light on CPU work. */
    private static final int TARGET_WIDTH = 1000;

    private final E1KartProperties props;
    private final Semaphore slots;

    public OcrService(E1KartProperties props) {
        this.props = props;
        this.slots = new Semaphore(Math.max(1, props.maxConcurrentOcr()));
    }

    public String readText(byte[] imageBytes) {
        BufferedImage image = decode(imageBytes);
        BufferedImage prepared = toGray(image);

        boolean acquired = false;
        Path tmp = null;
        Path out = null;
        try {
            acquired = slots.tryAcquire(props.ocrTimeoutSeconds(), TimeUnit.SECONDS);
            if (!acquired) {
                throw new ApiException(ErrorCode.OCR_FAILED);
            }
            tmp = Files.createTempFile("cert-", ".png");
            out = Files.createTempFile("cert-", ".txt");
            ImageIO.write(prepared, "png", tmp.toFile());

            // Output goes to a file and stderr is discarded: this way the timeout works even if tesseract hangs.
            Process p = new ProcessBuilder(List.of(props.tesseractCommand(), tmp.toString(), "stdout", "-l", "eng", "--psm", "3"))
                    .redirectOutput(out.toFile())
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            if (!p.waitFor(props.ocrTimeoutSeconds(), TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new ApiException(ErrorCode.OCR_FAILED);
            }
            if (p.exitValue() != 0) {
                log.warn("tesseract exit code {}", p.exitValue());
                throw new ApiException(ErrorCode.OCR_FAILED);
            }
            return Files.readString(out, StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("OCR failed", e);
            throw new ApiException(ErrorCode.OCR_FAILED, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.OCR_FAILED, e);
        } finally {
            if (acquired) {
                slots.release();
            }
            deleteQuietly(tmp);
            deleteQuietly(out);
        }
    }

    private static void deleteQuietly(Path p) {
        if (p == null) {
            return;
        }
        try {
            Files.deleteIfExists(p);
        } catch (IOException e) {
            log.warn("Temp file not deleted: {}", p);
        }
    }

    private static BufferedImage decode(byte[] bytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null || img.getWidth() < 200 || img.getHeight() < 200) {
                throw new ApiException(ErrorCode.UNSUPPORTED_FILE);
            }
            return img;
        } catch (IOException e) {
            throw new ApiException(ErrorCode.UNSUPPORTED_FILE, e);
        }
    }

    private static BufferedImage toGray(BufferedImage src) {
        double scale = (double) TARGET_WIDTH / src.getWidth();
        int w = TARGET_WIDTH;
        int h = (int) Math.round(src.getHeight() * scale);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.drawImage(src, 0, 0, w, h, java.awt.Color.WHITE, null);
        g.dispose();
        return out;
    }
}
