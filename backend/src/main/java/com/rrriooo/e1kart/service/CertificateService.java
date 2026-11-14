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
import com.rrriooo.e1kart.model.CertificateKind;
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
 * <p>
 * FAVORITE MCD STAGE certificates (Bloody Paradise) go through the same steps with their own ENHYPEN check
 * (McdMatcher: the single stage photo, refused only when clearly another stage), their own runs, and IDs compared
 * only with other MCD IDs. The kind comes from the certificate's text, then its layout, then the player's track.
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
    private final McdMatcher mcd;
    private final CertificateParser parser;
    private final CertificateIdHasher hasher;
    private final CertificateRepository certificates;
    private final RunService runService;
    private final RateLimiter rateLimiter;
    private final E1KartProperties props;
    private final StatsService stats;

    public CertificateService(OcrService ocr, IdReader idReader, EnhypenMatcher enhypen, McdMatcher mcd, CertificateParser parser,
                              CertificateIdHasher hasher, CertificateRepository certificates,
                              RunService runService, RateLimiter rateLimiter, E1KartProperties props, StatsService stats) {
        this.ocr = ocr;
        this.idReader = idReader;
        this.enhypen = enhypen;
        this.mcd = mcd;
        this.parser = parser;
        this.hasher = hasher;
        this.certificates = certificates;
        this.runService = runService;
        this.rateLimiter = rateLimiter;
        this.props = props;
        this.stats = stats;
    }

    /**
     * Redeems the certificate and counts the outcome in the stats (accepted, or the error code). trackHint is the
     * track the player is uploading for ("space", "bloody"): it decides the kind only when the certificate itself
     * doesn't say.
     */
    public RedeemResponse redeem(Player player, MultipartFile file, String trackHint, String clientIp) {
        rateLimiter.check("player:" + player.getId(), "ip:" + clientIp);
        try {
            RedeemResponse r = check(player, file, CertificateKind.forCertificate(trackHint));
            stats.count("certificate", CertificateKind.MCD.name().equals(r.kind()) ? "accepted_mcd" : "accepted");
            return r;
        } catch (ApiException e) {
            stats.count("certificate", e.code().name());
            throw e;
        }
    }

    private RedeemResponse check(Player player, MultipartFile file, CertificateKind hint) {

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
        String text = ocr.readText(bytes);
        CertificateKind kind = kindOf(text, card, hint);
        boolean enhypenSeen = kind == CertificateKind.MCD ? checkMcd(card) : checkEnhypen(card);

        boolean certificateLayout = card.screenshot() || CertificateImage.layoutOk(card.image());
        if (!enhypenSeen && !certificateLayout && !parser.isCertificateText(text)) {
            throw new ApiException(ErrorCode.NOT_A_CERTIFICATE); // nothing about it looks like a certificate
        }
        ParsedCertificate parsed = parser.parseFields(text);
        LocalDateTime votedAt = parsed.participationAt();
        if (votedAt == null) {
            votedAt = LocalDateTime.now(ZoneId.of(props.zone()));
            log.info("Vote date not readable: upload time used");
        } else if (kind == CertificateKind.FANS_CHOICE && !props.voteWindows().isEmpty()
                && props.voteWindows().stream().noneMatch(w -> w.contains(parsed.participationAt()))) {
            log.info("Vote date {} outside the voting windows: accepted", votedAt);
        }

        String id = readId(card, parsed);
        if (kind == CertificateKind.MCD) {
            id = CertificateParser.fixDatePrefix(id, parsed.participationAt());
        }
        // IDs are only compared within their kind: MCD keys carry a prefix, FANS' CHOICE keys are as before.
        String key = id != null ? CertificateParser.normalizeId(id) : "FILE:" + sha256(bytes);
        String idHash = hasher.hash(kind == CertificateKind.MCD ? "MCD:" + key : key);
        if (certificates.existsByIdHash(idHash)) {
            throw new ApiException(ErrorCode.ALREADY_USED);
        }
        int runs = props.runsPerCertificate();
        String category = kind == CertificateKind.MCD ? "FAVORITE MCD STAGE VOTE" : parsed.category();
        try {
            certificates.saveAndFlush(new Certificate(idHash, player.getId(), votedAt, category, kind, runs, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // Two near-simultaneous uploads of the same certificate: the first one wins.
            throw new ApiException(ErrorCode.ALREADY_USED, e);
        }
        log.info("{} certificate redeemed by {} ({} {}{})", kind, player.getId(), votedAt, category, id == null ? ", no readable ID" : "");
        return new RedeemResponse(runs, runService.balance(player, kind), votedAt, category, kind.name(), kind.track());
    }

    /**
     * FANS' CHOICE or MCD: what the text says, else the card's layout (one photo in the middle means MCD),
     * else the track the player is uploading for.
     */
    static CertificateKind kindOf(String text, CertificateImage.Card card, CertificateKind hint) {
        CertificateKind fromText = CertificateParser.kindFromText(text);
        if (fromText != null) {
            return fromText;
        }
        if (CertificateImage.singleImageLayout(card.image())) {
            return CertificateKind.MCD;
        }
        return CertificateImage.layoutOk(card.image()) ? CertificateKind.FANS_CHOICE : hint;
    }

    /**
     * MCD certificates: refused only when the stage photo is surely not ENHYPEN's; returns true when it was
     * recognised. Skipped (a warning is logged at startup) when no MCD references are configured.
     */
    private boolean checkMcd(CertificateImage.Card card) {
        if (!mcd.enabled()) {
            return false;
        }
        McdMatcher.Result r = mcd.check(card);
        log.debug("MCD ENHYPEN check: {} ({})", r.verdict(), String.format("%.2f", r.similarity()));
        return switch (r.verdict()) {
            case ENHYPEN -> true;
            case NOT_ENHYPEN -> throw new ApiException(ErrorCode.MCD_NOT_ENHYPEN);
            case UNCLEAR -> false; // in doubt: accepted
        };
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
