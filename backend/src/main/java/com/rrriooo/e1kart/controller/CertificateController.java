package com.rrriooo.e1kart.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.rrriooo.e1kart.dto.RedeemResponse;
import com.rrriooo.e1kart.service.CertificateService;
import com.rrriooo.e1kart.service.PlayerService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/certificates")
public class CertificateController {

    private final PlayerService playerService;
    private final CertificateService certificateService;

    public CertificateController(PlayerService playerService, CertificateService certificateService) {
        this.playerService = playerService;
        this.certificateService = certificateService;
    }

    /**
     * Receives the certificate screenshot (field "file") and grants runs to the player. Optional field "track": the
     * track the player is uploading for, used for the certificate kind only when the certificate doesn't show it.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public RedeemResponse redeem(@RequestHeader(value = PlayerController.TOKEN_HEADER, required = false) String token,
                                 @RequestPart("file") MultipartFile file,
                                 @RequestParam(value = "track", required = false) String track,
                                 HttpServletRequest request) {
        return certificateService.redeem(playerService.requirePlayer(token), file, track, request.getRemoteAddr());
    }
}
