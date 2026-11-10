package com.rrriooo.e1kart.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
import com.rrriooo.e1kart.service.PixelImage.Filter;

/**
 * Reads the "No. &lt;ID&gt;" line of the certificate card several times, like the collab verifier:
 * the line is cropped and read at different heights, plain and binarised (3 readings, up to 8 when they
 * disagree), with Tesseract in single-line mode, a A-Z0-9 whitelist and no dictionaries (the ID is a random
 * string and word models "correct" it). When nothing is read at the standard place, the line is looked for higher up.
 */
@Service
public class IdReader {

    private static final Logger log = LoggerFactory.getLogger(IdReader.class);
    private static final String ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    /** (height in pixels, binarised) of each reading, in order. */
    private static final Object[][] PLAN = {{110, false}, {150, true}, {200, false}, {110, true}, {200, true}, {150, false}, {260, true}, {130, true}};

    private final E1KartProperties props;
    private final Semaphore slots;

    public IdReader(E1KartProperties props, OcrService ocr) {
        this.props = props;
        this.slots = ocr.slots(); // shares the OCR budget with the full-page reading
    }

    /** Raw readings of the ID line (null entries are readings without a 16–18 character result). */
    public List<String> read(PixelImage card) {
        double[] box = CertificateImage.ID_BOX;
        List<String> readings = readStrip(card.cropFraction(box[0], box[1], box[2], box[3]).gray());
        if (readings.stream().allMatch(r -> r == null)) {
            double[] moved = CertificateImage.idLine(card);
            if (moved != null && Math.abs(moved[1] - box[1]) > 0.01) {
                return readStrip(card.cropFraction(moved[0], moved[1], moved[2], moved[3]).gray());
            }
        }
        return readings;
    }

    private List<String> readStrip(PixelImage strip) {
        List<String> readings = new ArrayList<>();
        if (strip.width == 0 || strip.height == 0) {
            return readings;
        }
        for (Object[] step : PLAN) {
            readings.add(variant(strip, (Integer) step[0], (Boolean) step[1]));
            if (IdVotes.settled(readings)) {
                break;
            }
        }
        return readings;
    }

    private String variant(PixelImage strip, int height, boolean binarise) {
        double scale = Math.min(8.0, Math.max(1.0, (double) height / strip.height));
        PixelImage img = strip.resize(PixelImage.pyRound(strip.width * scale), PixelImage.pyRound(strip.height * scale), Filter.LANCZOS).autocontrast();
        if (binarise) {
            img = img.threshold(p -> p > 150);
        }
        return IdVotes.squash(tesseract(img.expand(24, 255)));
    }

    private String tesseract(PixelImage img) {
        boolean acquired = false;
        try {
            acquired = slots.tryAcquire(props.ocrTimeoutSeconds(), TimeUnit.SECONDS);
            if (!acquired) {
                throw new ApiException(ErrorCode.OCR_FAILED);
            }
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(img.toBuffered(), "png", png);
            ProcessBuilder pb = new ProcessBuilder(props.tesseractCommand(), "stdin", "stdout", "--psm", "7", "-l", "eng",
                    "-c", "tessedit_char_whitelist=" + ALNUM, "-c", "load_system_dawg=0", "-c", "load_freq_dawg=0")
                    .redirectError(ProcessBuilder.Redirect.DISCARD);
            pb.environment().put("OMP_THREAD_LIMIT", "1");
            Process p = pb.start();
            try (var in = p.getOutputStream()) {
                in.write(png.toByteArray());
            }
            byte[] out = p.getInputStream().readAllBytes();
            if (!p.waitFor(props.ocrTimeoutSeconds(), TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new ApiException(ErrorCode.OCR_FAILED);
            }
            return new String(out, StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("OCR of the ID line failed", e);
            throw new ApiException(ErrorCode.OCR_FAILED, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(ErrorCode.OCR_FAILED, e);
        } finally {
            if (acquired) {
                slots.release();
            }
        }
    }
}
