package com.rrriooo.e1kart.service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rrriooo.e1kart.model.Room;
import com.rrriooo.e1kart.model.RoomPlayer;

import jakarta.annotation.PreDestroy;

/**
 * Real-time multiplayer: rooms with a code, up to six players, the track chosen by whoever creates the room.
 * Everything is in memory and nothing counts for the standings.
 *
 * The server does not simulate the race: it keeps the rooms, checks teams and phases, and relays what each game
 * sends about its own kart (and, from the host, about the CPU karts) to the others in the room.
 *
 * Messages are JSON objects with a "t" field.
 * From the game:
 *   peek {code}            what track a room is on (before joining, the game may have to load that track first)
 *   create {track, team}   new room, the sender is its host
 *   join {code, team}      joins a room in the lobby (team is dropped if taken: the player picks another one)
 *   team {team}            changes team in the lobby
 *   start                  host only, with 2 players or more: everyone goes to the pre-race dialogue
 *   ready                  the pre-race dialogue is over: when everyone is ready (or after INTRO_TIMEOUT) the lights go
 *   s {...}, ev {...}      kart state and race events, relayed to the others with the sender's id
 *   fin {time}             crossed the finish line
 *   leave, ping
 * To the game:
 *   room {code, track, state, host, you, players[{id, team}]}   after every change
 *   info {code, track, state, count}, intro, go, s, ev, fin {id, time}, left {id}, closed, pong, err {e}
 */
@Service
public class RoomService {

    public static final int MAX_PLAYERS = 6;
    static final int MAX_ROOMS = 300;
    static final int MAX_MESSAGE = 2048;
    static final int MAX_PER_SECOND = 40;
    static final long INTRO_TIMEOUT_MS = 30_000;
    static final long RACE_TIMEOUT_MS = 6 * 60_000;
    static final long AFTER_FIRST_FINISH_MS = 90_000;
    static final long IDLE_MS = 30 * 60_000;
    static final Set<String> TRACKS = Set.of("night", "space", "bloody", "want");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int TEAMS = 6;

    private final ObjectMapper json = new ObjectMapper();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<RoomPeer, RoomPlayer> players = new ConcurrentHashMap<>();
    private final ScheduledExecutorService timer;
    private final LongSupplier clock;

    public RoomService() {
        this(Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "rooms");
            t.setDaemon(true);
            return t;
        }), System::currentTimeMillis);
        timer.scheduleAtFixedRate(this::sweep, 1, 1, TimeUnit.MINUTES);
    }

    /** For tests: timeouts go to the given executor, time comes from the given clock. */
    RoomService(ScheduledExecutorService timer, LongSupplier clock) {
        this.timer = timer;
        this.clock = clock;
    }

    @PreDestroy
    void shutdown() {
        timer.shutdownNow();
    }

    int roomCount() {
        return rooms.size();
    }

    // ---------- Transport events ----------

    public void onMessage(RoomPeer peer, String text) {
        if (text == null || text.length() > MAX_MESSAGE) {
            return;
        }
        RoomPlayer me = players.get(peer);
        if (me != null && !me.allow(clock.getAsLong(), MAX_PER_SECOND)) {
            return;
        }
        JsonNode msg;
        try {
            msg = json.readTree(text);
        } catch (Exception e) {
            return;
        }
        if (msg == null || !msg.isObject()) {
            return;
        }
        switch (msg.path("t").asText("")) {
            case "ping" -> peer.send("{\"t\":\"pong\"}");
            case "peek" -> peek(peer, msg);
            case "create" -> create(peer, msg);
            case "join" -> join(peer, msg);
            case "leave" -> leave(peer);
            default -> {
                if (me != null) {
                    inRoom(me, msg);
                }
            }
        }
    }

    public void onClose(RoomPeer peer) {
        leave(peer);
    }

    // ---------- Outside a room ----------

    private void peek(RoomPeer peer, JsonNode msg) {
        Room room = rooms.get(code(msg));
        if (room == null) {
            error(peer, "notfound");
            return;
        }
        synchronized (room) {
            ObjectNode out = json.createObjectNode();
            out.put("t", "info");
            out.put("code", room.getCode());
            out.put("track", room.getTrack());
            out.put("state", room.getState().name().toLowerCase(Locale.ROOT));
            out.put("count", room.getPlayers().size());
            peer.send(out.toString());
        }
    }

    private void create(RoomPeer peer, JsonNode msg) {
        leave(peer);
        String track = msg.path("track").asText("");
        if (!TRACKS.contains(track)) {
            error(peer, "badtrack");
            return;
        }
        if (rooms.size() >= MAX_ROOMS) {
            error(peer, "busy");
            return;
        }
        long now = clock.getAsLong();
        Room room;
        String code;
        do {
            code = newCode();
            room = new Room(code, track, now);
        } while (rooms.putIfAbsent(code, room) != null);
        synchronized (room) {
            RoomPlayer host = new RoomPlayer(room.nextPlayerId(), peer, room, team(msg));
            room.getPlayers().add(host);
            room.setHostId(host.getId());
            players.put(peer, host);
            broadcastRoom(room);
        }
    }

    private void join(RoomPeer peer, JsonNode msg) {
        leave(peer);
        Room room = rooms.get(code(msg));
        if (room == null) {
            error(peer, "notfound");
            return;
        }
        synchronized (room) {
            if (room.isClosed()) {
                error(peer, "notfound");
                return;
            }
            if (room.getState() != Room.State.LOBBY) {
                error(peer, "started");
                return;
            }
            if (room.getPlayers().size() >= MAX_PLAYERS) {
                error(peer, "full");
                return;
            }
            Integer team = team(msg);
            if (team != null && room.teamTaken(team, null)) {
                team = null;
            }
            RoomPlayer p = new RoomPlayer(room.nextPlayerId(), peer, room, team);
            room.getPlayers().add(p);
            players.put(peer, p);
            room.touch(clock.getAsLong());
            broadcastRoom(room);
        }
    }

    // ---------- Inside a room ----------

    private void inRoom(RoomPlayer me, JsonNode msg) {
        Room room = me.getRoom();
        synchronized (room) {
            if (room.isClosed() || me.getRoom() != room) {
                return;
            }
            room.touch(clock.getAsLong());
            switch (msg.path("t").asText("")) {
                case "team" -> chooseTeam(room, me, msg);
                case "start" -> start(room, me);
                case "ready" -> ready(room, me);
                case "s", "ev" -> relay(room, me, msg);
                case "fin" -> finish(room, me, msg);
                default -> { }
            }
        }
    }

    private void chooseTeam(Room room, RoomPlayer me, JsonNode msg) {
        Integer team = team(msg);
        if (room.getState() != Room.State.LOBBY || team == null || room.teamTaken(team, me)) {
            error(me.getPeer(), "team");
            broadcastRoom(room); // shows the player the teams as they really are
            return;
        }
        me.setTeam(team);
        broadcastRoom(room);
    }

    private void start(Room room, RoomPlayer me) {
        if (me.getId() != room.getHostId() || room.getState() != Room.State.LOBBY) {
            return;
        }
        if (room.getPlayers().size() < 2) {
            error(me.getPeer(), "alone");
            return;
        }
        if (room.getPlayers().stream().anyMatch(p -> p.getTeam() == null)) {
            error(me.getPeer(), "teams");
            return;
        }
        room.setState(Room.State.INTRO);
        room.setSomeoneFinished(false);
        room.getPlayers().forEach(p -> {
            p.setReady(false);
            p.setFinished(false);
        });
        int phase = room.newPhase();
        broadcastRoom(room);
        broadcast(room, "{\"t\":\"intro\"}", null);
        later(room, phase, INTRO_TIMEOUT_MS, () -> go(room));
    }

    private void ready(Room room, RoomPlayer me) {
        if (room.getState() != Room.State.INTRO) {
            return;
        }
        me.setReady(true);
        if (room.getPlayers().stream().allMatch(RoomPlayer::isReady)) {
            go(room);
        }
    }

    private void go(Room room) {
        if (room.getState() != Room.State.INTRO) {
            return;
        }
        room.setState(Room.State.RACE);
        int phase = room.newPhase();
        broadcastRoom(room);
        broadcast(room, "{\"t\":\"go\"}", null);
        later(room, phase, RACE_TIMEOUT_MS, () -> toLobby(room));
    }

    private void relay(Room room, RoomPlayer me, JsonNode msg) {
        if (room.getState() != Room.State.RACE) {
            return;
        }
        ObjectNode out = ((ObjectNode) msg).deepCopy();
        out.put("id", me.getId());
        broadcast(room, out.toString(), me);
    }

    private void finish(Room room, RoomPlayer me, JsonNode msg) {
        if (room.getState() != Room.State.RACE || me.isFinished()) {
            return;
        }
        me.setFinished(true);
        ObjectNode out = json.createObjectNode();
        out.put("t", "fin");
        out.put("id", me.getId());
        out.put("time", msg.path("time").asDouble(0));
        broadcast(room, out.toString(), null);
        if (room.getPlayers().stream().allMatch(RoomPlayer::isFinished)) {
            toLobby(room);
        } else if (!room.isSomeoneFinished()) {
            // Nobody waits forever for a player who stopped racing.
            room.setSomeoneFinished(true);
            later(room, room.getPhase(), AFTER_FIRST_FINISH_MS, () -> toLobby(room));
        }
    }

    private void toLobby(Room room) {
        if (room.getState() == Room.State.LOBBY) {
            return;
        }
        room.setState(Room.State.LOBBY);
        room.newPhase();
        broadcastRoom(room);
    }

    private void leave(RoomPeer peer) {
        RoomPlayer me = players.remove(peer);
        if (me == null) {
            return;
        }
        Room room = me.getRoom();
        synchronized (room) {
            room.getPlayers().remove(me);
            me.setRoom(null);
            if (room.getPlayers().isEmpty()) {
                room.setClosed(true);
                rooms.remove(room.getCode(), room);
                return;
            }
            if (room.getHostId() == me.getId()) {
                room.setHostId(room.getPlayers().get(0).getId());
            }
            broadcast(room, "{\"t\":\"left\",\"id\":" + me.getId() + "}", null);
            broadcastRoom(room);
            if (room.getState() == Room.State.INTRO && room.getPlayers().stream().allMatch(RoomPlayer::isReady)) {
                go(room);
            } else if (room.getState() == Room.State.RACE && room.getPlayers().stream().allMatch(RoomPlayer::isFinished)) {
                toLobby(room);
            }
        }
    }

    /** Closes the rooms nobody has used for a while. */
    void sweep() {
        long now = clock.getAsLong();
        for (Room room : new ArrayList<>(rooms.values())) {
            List<RoomPlayer> gone;
            synchronized (room) {
                if (now - room.getLastActivity() < IDLE_MS) {
                    continue;
                }
                room.setClosed(true);
                rooms.remove(room.getCode(), room);
                gone = new ArrayList<>(room.getPlayers());
                room.getPlayers().clear();
                broadcastTo(gone, "{\"t\":\"closed\"}");
            }
            gone.forEach(p -> {
                players.remove(p.getPeer());
                p.getPeer().close();
            });
        }
    }

    // ---------- Helpers ----------

    private void later(Room room, int phase, long ms, Runnable action) {
        timer.schedule(() -> {
            synchronized (room) {
                if (!room.isClosed() && room.getPhase() == phase) {
                    action.run();
                }
            }
        }, ms, TimeUnit.MILLISECONDS);
    }

    private void broadcastRoom(Room room) {
        ObjectNode out = json.createObjectNode();
        out.put("t", "room");
        out.put("code", room.getCode());
        out.put("track", room.getTrack());
        out.put("state", room.getState().name().toLowerCase(Locale.ROOT));
        out.put("host", room.getHostId());
        ArrayNode list = out.putArray("players");
        for (RoomPlayer p : room.getPlayers()) {
            ObjectNode o = list.addObject();
            o.put("id", p.getId());
            if (p.getTeam() == null) {
                o.putNull("team");
            } else {
                o.put("team", p.getTeam());
            }
        }
        for (RoomPlayer p : room.getPlayers()) {
            out.put("you", p.getId());
            p.getPeer().send(out.toString());
        }
    }

    private void broadcast(Room room, String text, RoomPlayer except) {
        for (RoomPlayer p : room.getPlayers()) {
            if (p != except) {
                p.getPeer().send(text);
            }
        }
    }

    private static void broadcastTo(List<RoomPlayer> list, String text) {
        list.forEach(p -> p.getPeer().send(text));
    }

    private void error(RoomPeer peer, String code) {
        peer.send("{\"t\":\"err\",\"e\":\"" + code + "\"}");
    }

    private static String code(JsonNode msg) {
        return msg.path("code").asText("").trim().toUpperCase(Locale.ROOT);
    }

    private static Integer team(JsonNode msg) {
        JsonNode t = msg.path("team");
        if (!t.isInt()) {
            return null;
        }
        int v = t.asInt();
        return v >= 0 && v < TEAMS ? v : null;
    }

    private String newCode() {
        StringBuilder sb = new StringBuilder(5);
        for (int k = 0; k < 5; k++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
