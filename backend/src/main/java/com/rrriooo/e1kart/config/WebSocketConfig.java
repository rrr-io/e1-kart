package com.rrriooo.e1kart.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.rrriooo.e1kart.controller.MultiplayerSocketHandler;

/** Multiplayer WebSocket at /api/mp (Caddy forwards /api/* to the backend, WebSockets included). */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MultiplayerSocketHandler handler;

    public WebSocketConfig(MultiplayerSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/mp")
                .setAllowedOriginPatterns("https://e1-kart.ensite.org", "https://e1kart.rrriooo.com",
                        "http://localhost:*", "http://127.0.0.1:*");
    }
}
