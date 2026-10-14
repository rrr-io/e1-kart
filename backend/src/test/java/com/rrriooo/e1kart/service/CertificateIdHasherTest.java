package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class CertificateIdHasherTest {

    @Test
    void sameIdSameHash() {
        CertificateIdHasher h = new CertificateIdHasher("a-secret-of-at-least-16");
        assertEquals(h.hash("61013P5EM74JDMJZ"), h.hash("61013P5EM74JDMJZ"));
        assertEquals(64, h.hash("61013P5EM74JDMJZ").length());
    }

    @Test
    void differentSecretDifferentHash() {
        String id = "61013P5EM74JDMJZ";
        assertNotEquals(new CertificateIdHasher("secret-number-one-xx").hash(id), new CertificateIdHasher("secret-number-two-xx").hash(id));
    }

    @Test
    void rejectsShortSecret() {
        assertThrows(IllegalArgumentException.class, () -> new CertificateIdHasher("short"));
    }
}
