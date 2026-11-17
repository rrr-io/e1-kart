package com.rrriooo.e1kart.controller;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.rrriooo.e1kart.service.RoomPeer;
import com.rrriooo.e1kart.service.RoomService;

/** WebSocket /api/mp: hands every connection to the RoomService (multiplayer rooms). */
@Component
public class MultiplayerSocketHandler extends TextWebSocketHandler {

    static final int MAX_CONNECTIONS = 1200;

    private final RoomService rooms;
    private final Map<String, SessionPeer> peers = new ConcurrentHashMap<>();

    public MultiplayerSocketHandler(RoomService rooms) {
        this.rooms = rooms;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        if (peers.size() >= MAX_CONNECTIONS) {
            session.close(CloseStatus.SERVICE_OVERLOAD);
            return;
        }
        session.setTextMessageSizeLimit(4096);
        // Sends can come from several threads (relays, timeouts): the decorator queues them; a client that
        // stops reading for 5 s or falls 256 KB behind is disconnected.
        peers.put(session.getId(), new SessionPeer(new ConcurrentWebSocketSessionDecorator(session, 5000, 256 * 1024)));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        SessionPeer peer = peers.get(session.getId());
        if (peer != null) {
            rooms.onMessage(peer, message.getPayload());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        session.close(CloseStatus.SERVER_ERROR);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        SessionPeer peer = peers.remove(session.getId());
        if (peer != null) {
            rooms.onClose(peer);
        }
    }

    /** A WebSocket session seen as a RoomPeer. */
    static final class SessionPeer implements RoomPeer {
        private final WebSocketSession session;

        SessionPeer(WebSocketSession session) {
            this.session = session;
        }

        @Override
        public void send(String json) {
            if (!session.isOpen()) {
                return;
            }
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException | IllegalStateException e) {
                close();
            }
        }

        @Override
        public void close() {
            try {
                session.close();
            } catch (IOException e) {
                // already closed
            }
        }
    }
}
