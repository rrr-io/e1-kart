package com.rrriooo.e1kart.model;

import java.util.Locale;

/**
 * The kinds of run. The first two are the kinds of MAMA voting certificate the game takes. Each kind has its own runs: FANS' CHOICE certificates
 * unlock Interstellar, FAVORITE MCD STAGE certificates unlock Bloody Paradise. Certificate IDs are only compared
 * with IDs of the same kind. FREE is not a certificate: it marks the races of the free tracks that count for the
 * standings (Parallel World), which cost nothing and have no balance.
 */
public enum CertificateKind {

    /** "FANS' CHOICE Category" vote: three thumbnails, the last one is the voted artist. Track: Interstellar. */
    FANS_CHOICE("space"),
    /** "FAVORITE MCD STAGE with Mnet Plus VOTE": one stage photo in the middle. Track: Bloody Paradise. */
    MCD("bloody"),
    /** No certificate: free races that count for the standings. Track: Parallel World. */
    FREE("want");

    private final String track;

    CertificateKind(String track) {
        this.track = track;
    }

    /** The game's track id these runs are for. */
    public String track() {
        return track;
    }

    /** True for races that need no certificate run. */
    public boolean free() {
        return this == FREE;
    }

    /** The kind of runs a track uses; unknown or missing tracks are Interstellar (FANS' CHOICE), as before. */
    public static CertificateKind forTrack(String track) {
        String t = track == null ? "" : track.toLowerCase(Locale.ROOT);
        return MCD.track.equals(t) ? MCD : FREE.track.equals(t) ? FREE : FANS_CHOICE;
    }

    /** The kind of certificate uploaded from a track's page: never FREE, which has no certificates. */
    public static CertificateKind forCertificate(String track) {
        CertificateKind k = forTrack(track);
        return k.free() ? FANS_CHOICE : k;
    }

    /** Stored value: null (rows saved before the kinds existed) is FANS' CHOICE. */
    public static CertificateKind of(String stored) {
        return MCD.name().equals(stored) ? MCD : FREE.name().equals(stored) ? FREE : FANS_CHOICE;
    }
}
