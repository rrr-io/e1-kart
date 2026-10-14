package com.rrriooo.e1kart.exception;

/** Application exception translated into a JSON response by ApiExceptionHandler. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code) {
        super(code.message());
        this.code = code;
    }

    public ApiException(ErrorCode code, Throwable cause) {
        super(code.message(), cause);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }
}
