package com.rrriooo.e1kart.service;

import java.io.IOException;
import java.time.Instant;
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
 * Certificate redemption: OCR → field extraction → voting-window check →
 * duplicate check on the ID hash → save with the granted runs.
 */
@Service
public class CertificateService {

    private static final Logger log = LoggerFactory.getLogger(CertificateService.class);
    private static final Set<String> ACCEPTED_TYPES = Set.of("image/png", "image/jpeg", "image/jpg");

    private final OcrService ocr;
    private final CertificateParser parser;
    private final CertificateIdHasher hasher;
    private final CertificateRepository certificates;
    private final RunService runService;
    private final RateLimiter rateLimiter;
    private final E1KartProperties props;

    public CertificateService(OcrService ocr, CertificateParser parser, CertificateIdHasher hasher,
                              CertificateRepository certificates, RunService runService,
                              RateLimiter rateLimiter, E1KartProperties props) {
        this.ocr = ocr;
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
        String text = ocr.readText(bytes);
        ParsedCertificate parsed = parser.parse(text);

        if (!props.voteWindows().isEmpty()
                && props.voteWindows().stream().noneMatch(w -> w.contains(parsed.participationAt()))) {
            throw new ApiException(ErrorCode.OUTSIDE_VOTING_WINDOW);
        }

        String idHash = hasher.hash(parsed.normalizedId());
        if (certificates.existsByIdHash(idHash)) {
            throw new ApiException(ErrorCode.ALREADY_USED);
        }
        int runs = props.runsPerCertificate();
        try {
            certificates.saveAndFlush(new Certificate(idHash, player.getId(), parsed.participationAt(), parsed.category(), runs, Instant.now()));
        } catch (DataIntegrityViolationException e) {
            // Two near-simultaneous uploads of the same certificate: the first one wins.
            throw new ApiException(ErrorCode.ALREADY_USED, e);
        }
        log.info("Certificate redeemed by {} ({} {})", player.getId(), parsed.participationAt(), parsed.category());
        return new RedeemResponse(runs, runService.balance(player), parsed.participationAt(), parsed.category());
    }
}
