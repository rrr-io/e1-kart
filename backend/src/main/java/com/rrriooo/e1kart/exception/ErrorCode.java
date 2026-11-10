package com.rrriooo.e1kart.exception;

/** Errors returned by the API, with an HTTP status and a message shown to the player (in English, the game's UI language). */
public enum ErrorCode {

    INVALID_PLAYER(401, "Player not recognized. Please reload the page."),
    UNSUPPORTED_FILE(415, "Upload a PNG or JPG screenshot of the certificate."),
    FILE_TOO_LARGE(413, "The image is too large (8 MB max)."),
    NOT_A_CERTIFICATE(422, "This doesn't look like a MAMA voting certificate. Upload the full certificate screenshot."),
    ID_NOT_FOUND(422, "Couldn't read the certificate number (No. …). Try a sharper, uncropped screenshot."),
    DATE_NOT_FOUND(422, "Couldn't read the vote date. Try a sharper, uncropped screenshot."),
    OUTSIDE_VOTING_WINDOW(422, "The vote date isn't within a valid voting period."),
    NOT_ENHYPEN(422, "This certificate isn't valid. You didn't vote ENHYPEN for the Daesang."),
    ENHYPEN_NOT_LAST(422, "This certificate isn't valid. You didn't vote ENHYPEN for the Daesang."),
    ALREADY_USED(409, "This certificate has already been used."),
    NO_RUNS(402, "You have no runs left. Upload a new voting certificate."),
    RUN_NOT_FOUND(404, "Race not found."),
    RATE_LIMITED(429, "Too many uploads in a short time. Try again in a minute."),
    NOT_FOUND(404, "Not found."),
    NOT_AUTHORIZED(401, "Wrong or missing stats token."),
    OCR_FAILED(503, "Couldn't read the certificate. Try again shortly.");

    private final int status;
    private final String message;

    ErrorCode(int status, String message) {
        this.status = status;
        this.message = message;
    }

    public int status() {
        return status;
    }

    public String message() {
        return message;
    }
}
