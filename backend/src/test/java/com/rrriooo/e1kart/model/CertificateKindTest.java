package com.rrriooo.e1kart.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CertificateKindTest {

    @Test
    void tracksMapToTheirKind() {
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forTrack("space"));
        assertEquals(CertificateKind.MCD, CertificateKind.forTrack("BLOODY"));
        assertEquals(CertificateKind.FREE, CertificateKind.forTrack("want"));
        // unknown or missing tracks stay Interstellar, as older versions of the game expect
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forTrack(null));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forTrack("night"));
    }

    @Test
    void onlyParallelWorldIsFree() {
        assertTrue(CertificateKind.FREE.free());
        assertFalse(CertificateKind.FANS_CHOICE.free());
        assertFalse(CertificateKind.MCD.free());
    }

    @Test
    void aCertificateIsNeverFree() {
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.forCertificate("want"));
        assertEquals(CertificateKind.MCD, CertificateKind.forCertificate("bloody"));
    }

    @Test
    void storedValuesRoundTrip() {
        assertEquals(CertificateKind.FREE, CertificateKind.of("FREE"));
        assertEquals(CertificateKind.MCD, CertificateKind.of("MCD"));
        assertEquals(CertificateKind.FANS_CHOICE, CertificateKind.of(null));
    }
}
