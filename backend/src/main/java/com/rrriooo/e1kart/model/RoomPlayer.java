package com.rrriooo.e1kart.model;

import com.rrriooo.e1kart.service.RoomPeer;

/**
 * A player in a multiplayer room (in memory only, nothing is saved). Fields are changed only while holding the
 * room's lock.
 */
public class RoomPlayer {

    private final int id;
    private final RoomPeer peer;
    private Room room;
    /** Team index 0-5, or null while the player still has to pick a free one. */
    private Integer team;
    private boolean ready;
    private boolean finished;
    // Messages in the current one-second window (flood protection).
    private long windowStart;
    private int windowCount;

    public RoomPlayer(int id, RoomPeer peer, Room room, Integer team) {
        this.id = id;
        this.peer = peer;
        this.room = room;
        this.team = team;
    }

    public int getId() { return id; }
    public RoomPeer getPeer() { return peer; }
    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
    public Integer getTeam() { return team; }
    public void setTeam(Integer team) { this.team = team; }
    public boolean isReady() { return ready; }
    public void setReady(boolean ready) { this.ready = ready; }
    public boolean isFinished() { return finished; }
    public void setFinished(boolean finished) { this.finished = finished; }

    /** Counts a message; false once the player sent more than max in the last second. */
    public synchronized boolean allow(long now, int max) {
        if (now - windowStart >= 1000) {
            windowStart = now;
            windowCount = 0;
        }
        return ++windowCount <= max;
    }
}
