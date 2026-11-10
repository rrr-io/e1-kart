package com.rrriooo.e1kart.service;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.dto.ParsedCertificate;
import com.rrriooo.e1kart.dto.RedeemResponse;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;
import com.rrriooo.e1kart.model.Certificate;
import com.rrriooo.e1kart.model.Player;
import com.rrriooo.e1kart.repository.CertificateRepository;

/**
 * Certificate redemption, lenient: when in doubt the certificate is accepted. It is refused only when it is
 * surely not an ENHYPEN certificate, or surely a duplicate. The checks are those of the collab verifier
 * (e1-social-race), but its "manual review" cases are accepted here:
 * <ol>
 * <li>the image is decoded and a phone screenshot is cut down to the certificate card;</li>
 * <li>refused if the last image is clearly not ENHYPEN, or ENHYPEN is on it but not last (standard layout only);
 * an unclear photo, a cropped screenshot or a card that can't be found is accepted;</li>
 * <li>refused if it is clearly not a certificate at all: no certificate layout, no certificate words, no ENHYPEN photo;</li>
 * <li>the "No." line is read several times and the readings vote for the ID; without agreement the best candidate
 * is used; with no readable ID, the file itself is the key (the same file can't be used twice);</li>
 * <li>refused if the ID (normalized O→0, I→1) was already used.</li>
 * </ol>
 * The vote date is read for the record; an unreadable date or a date outside the voting windows is only logged.
 */
@Service
public class CertificateService {

    private static final Logger log = LoggerFactory.getLogger(CertificateService.class);
    /** Phone screenshots are up to ~4.5 MP (1440×3120); larger photos are scaled down before the checks. */
    private static final long MAX_PIXELS = 6_000_000;
    private static final Set<String> ACCEPTED_TYPES = Set.of("image/png", "image/jpeg", "image/jpg");

    private final OcrService ocr;
    private final IdReader idReader;
    private final EnhypenMatcher enhypen;
    private final CertificateParser parser;
    private final CertificateIdHasher hasher;
    private final CertificateRepository certificates;
    private final RunService runService;
    private final RateLimiter rateLimiter;
    private final E1KartProperties props;

    public CertificateService(OcrService ocr, IdReader idReader, EnhypenMatcher enhypen, CertificateParser parser,
                              CertificateIdHasher hasher, CertificateRepository certificates,
                              RunService runService, RateLimiter rateLimiter, E1KartProperties props) {
        this.ocr = ocr;
        this.idReader = idReader;
        this.enhypen = enhypen;
        this.parser = parser;
        this.hasher = hasher;
        this.certificates = certificates;
        this.runService = runService;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    public RedeemResponse redeem(Player player, MultipartFile file, String clientIp) {
        rateLimiter.check("player:" + player.getId(), "ip:" + clientIp);

        if (file == null || file.isEmpty() || file.getContentType() == null || !ACCEPTED_TYPES.contains(file.getContentType().toLowerCase())) {
            throw new ApiException(ErrorCode.UNSUPPORTED_FILE);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.UNSUPPORTED_FILE, e);
        }

        // The image stays in memory only for the duration of this call.
        PixelImage image = PixelImage.decode(bytes);
        if (image == null || image.width < 200 || image.height < 200) {
            throw new ApiException(ErrorCode.UNSUPPORTED_FILE);
        }
        CertificateImage.Card card = CertificateImage.normalise(CertificateImage.limitSize(image, MAX_PIXELS));
        boolean enhypenSeen = checkEnhypen(card);

        String text = ocr.readText(bytes);
        boolean certificateLayout = card.screenshot() || CertificateImage.layoutOk(card.image());
        if (!enhypenSeen && !certificateLayout && !parser.isCertificateText(text)) {
            throw new ApiException(ErrorCode.NOT_A_CERTIFICATE); // nothing about it looks like a certificate
        }
        ParsedCertificate parsed = parser.parseFields(text);
        LocalDateTime votedAt = parsed.participationAt();
        if (votedAt == null) {
            votedAt = LocalDateTime.now(ZoneId.of(props.zone()));
            log.info("Vote date not readable: upload time used");
        } else if (!props.voteWindows().isEmpty() && props.voteWindows().stream().noneMatch(w -> w.contains(parsed.participationAt()))) {
            log.info("Vote date {} outside the voting windows: accepted", votedAt);
        }

        String id = readId(card, parsed);
        String idHash = hasher.hash(id != null ? CertificateParser.normalizeId(id) : "FILE:" + sha256(bytes));
        if (certificates.existsByIdHash(idHash)) {
            throw new ApiException(ErrorCode.ALREADY_USED);
        }
        int runs = props.runsPerCertificate();
        try {
            certificates.saveAndFlush(new Certificate(idHash, player.getId(), votedAt, parsed.category(), runs, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // Two near-simultaneous uploads of the same certificate: the first one wins.
            throw new ApiException(ErrorCode.ALREADY_USED, e);
        }
        log.info("Certificate redeemed by {} ({} {}{})", player.getId(), votedAt, parsed.category(), id == null ? ", no readable ID" : "");
        return new RedeemResponse(runs, runService.balance(player), votedAt, parsed.category());
    }

    /**
     * Refuses a certificate whose last image is surely not ENHYPEN; returns true when ENHYPEN was recognised.
     * Skipped (a warning is logged at startup) when no references are configured.
     */
    private boolean checkEnhypen(CertificateImage.Card card) {
        if (!enhypen.enabled()) {
            return false;
        }
        EnhypenMatcher.Result r = enhypen.check(card);
        log.debug("ENHYPEN check: {} ({})", r.verdict(), String.format("%.2f", r.similarity()));
        return switch (r.verdict()) {
            case ENHYPEN -> true;
            case NOT_ENHYPEN -> throw new ApiException(ErrorCode.NOT_ENHYPEN);
            case NOT_LAST -> throw new ApiException(ErrorCode.ENHYPEN_NOT_LAST);
            case UNCLEAR, NON_STANDARD -> false; // in doubt: accepted
        };
    }

    /**
     * The certificate ID, or null when none can be read: the readings of the "No." line vote; without agreement
     * the best guess (a leader, or candidates differing only in look-alike characters), then the candidate with the
     * most votes, then the full-page reading.
     */
    private String readId(CertificateImage.Card card, ParsedCertificate parsed) {
        PixelImage im = card.image();
        List<String> readings = CertificateImage.layoutOk(im) ? idReader.read(im) : List.of();
        String id = IdVotes.consensus(readings);
        if (id == null) {
            id = IdVotes.unsureGuess(readings);
        }
        if (id == null) {
            id = IdVotes.bestCandidate(readings);
        }
        return id != null ? id : parsed.rawId();
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
