package com.rrriooo.e1kart.model;

import java.util.ArrayList;
import java.util.List;

/**
 * A multiplayer room: up to six players racing together on the track chosen by whoever created it (the host).
 * In memory only. Every field is read and changed while holding the room's lock (synchronized on the room).
 */
public class Room {

    public enum State { LOBBY, INTRO, RACE }

    private final String code;
    private final String track;
    private final List<RoomPlayer> players = new ArrayList<>();
    private State state = State.LOBBY;
    private int hostId;
    private int nextId = 1;
    /** Changes at every new phase, so a timeout scheduled for an old phase does nothing. */
    private int phase;
    private boolean someoneFinished;
    private long lastActivity;
    private boolean closed;

    public Room(String code, String track, long now) {
        this.code = code;
        this.track = track;
        this.lastActivity = now;
    }

    public String getCode() { return code; }
    public String getTrack() { return track; }
    public List<RoomPlayer> getPlayers() { return players; }
    public State getState() { return state; }
    public void setState(State state) { this.state = state; }
    public int getHostId() { return hostId; }
    public void setHostId(int hostId) { this.hostId = hostId; }
    public int nextPlayerId() { return nextId++; }
    public int getPhase() { return phase; }
    public int newPhase() { return ++phase; }
    public boolean isSomeoneFinished() { return someoneFinished; }
    public void setSomeoneFinished(boolean someoneFinished) { this.someoneFinished = someoneFinished; }
    public long getLastActivity() { return lastActivity; }
    public void touch(long now) { this.lastActivity = now; }
    public boolean isClosed() { return closed; }
    public void setClosed(boolean closed) { this.closed = closed; }

    public boolean teamTaken(int team, RoomPlayer except) {
        for (RoomPlayer p : players) {
            if (p != except && p.getTeam() != null && p.getTeam() == team) {
                return true;
            }
        }
        return false;
    }
}
