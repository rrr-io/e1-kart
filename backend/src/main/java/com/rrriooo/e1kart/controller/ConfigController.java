package com.rrriooo.e1kart.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rrriooo.e1kart.config.E1KartProperties;
import com.rrriooo.e1kart.dto.ConfigResponse;

/** Public configuration read by the game on startup (e.g. whether to show the "free play" flag). */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final E1KartProperties props;

    public ConfigController(E1KartProperties props) {
        this.props = props;
    }

    @GetMapping
    public ConfigResponse config() {
        return new ConfigResponse(
                props.freePlayAllowed(),
                props.runsPerCertificate(),
                props.voteWindows().stream().map(w -> new ConfigResponse.Window(w.label(), w.start(), w.end())).toList());
    }
}
