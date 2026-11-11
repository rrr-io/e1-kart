package com.rrriooo.e1kart.model;

import java.util.Locale;

/**
 * The two kinds of MAMA voting certificate the game takes. Each kind has its own runs: FANS' CHOICE certificates
 * unlock Interstellar, FAVORITE MCD STAGE certificates unlock Bloody Paradise. Certificate IDs are only compared
 * with IDs of the same kind.
 */
public enum CertificateKind {

    /** "FANS' CHOICE Category" vote: three thumbnails, the last one is the voted artist. Track: Interstellar. */
    FANS_CHOICE("space"),
    /** "FAVORITE MCD STAGE with Mnet Plus VOTE": one stage photo in the middle. Track: Bloody Paradise. */
    MCD("bloody");

    private final String track;

    CertificateKind(String track) {
        this.track = track;
    }

    /** The game's track id these runs are for. */
    public String track() {
        return track;
    }

    /** The kind of runs a track uses; unknown or missing tracks are Interstellar (FANS' CHOICE), as before. */
    public static CertificateKind forTrack(String track) {
        return track != null && MCD.track.equals(track.toLowerCase(Locale.ROOT)) ? MCD : FANS_CHOICE;
    }

    /** Stored value: null (rows saved before the kinds existed) is FANS' CHOICE. */
    public static CertificateKind of(String stored) {
        return MCD.name().equals(stored) ? MCD : FANS_CHOICE;
    }
}
