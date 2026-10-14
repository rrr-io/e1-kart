package com.rrriooo.e1kart.service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * HMAC-SHA256 of the certificate's normalized ID. Only this hash ends up in the database:
 * it's enough to recognize an already-used certificate without keeping the plain ID around.
 */
public class CertificateIdHasher {

    private static final String ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    public CertificateIdHasher(String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("e1kart.id-secret deve essere lungo almeno 16 caratteri");
        }
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM);
    }

    public String hash(String normalizedId) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return HexFormat.of().formatHex(mac.doFinal(normalizedId.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC not available", e);
        }
    }
}
