package com.rrriooo.e1kart.service;

/** One connected game (a WebSocket session), as seen by the RoomService. Implementations must be thread-safe. */
public interface RoomPeer {

    /** Sends a JSON text message; errors are swallowed (a broken connection is closed by the transport). */
    void send(String json);

    void close();
}
