package com.rrriooo.e1kart.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import com.rrriooo.e1kart.dto.ErrorResponse;
import com.rrriooo.e1kart.exception.ApiException;
import com.rrriooo.e1kart.exception.ErrorCode;

/** All errors come out as JSON {code, message}; the game shows message directly. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> api(ApiException e) {
        return of(e.code());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> tooLarge() {
        return of(ErrorCode.FILE_TOO_LARGE);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> missingFile() {
        return of(ErrorCode.UNSUPPORTED_FILE);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> invalid() {
        return ResponseEntity.badRequest().body(new ErrorResponse("BAD_REQUEST", "Invalid request."));
    }

    private static ResponseEntity<ErrorResponse> of(ErrorCode code) {
        return ResponseEntity.status(HttpStatus.valueOf(code.status())).body(new ErrorResponse(code.name(), code.message()));
    }
}
