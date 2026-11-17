package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class RoomServiceTest {

    static final ObjectMapper JSON = new ObjectMapper();

    /** A connected game that keeps what it receives. */
    static class FakePeer implements RoomPeer {
        final List<JsonNode> got = new ArrayList<>();
        boolean closed;

        @Override
        public void send(String json) {
            try {
                got.add(JSON.readTree(json));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public void close() {
            closed = true;
        }

        JsonNode last(String type) {
            for (int k = got.size() - 1; k >= 0; k--) {
                if (got.get(k).path("t").asText().equals(type)) {
                    return got.get(k);
                }
            }
            return null;
        }

        long count(String type) {
            return got.stream().filter(n -> n.path("t").asText().equals(type)).count();
        }
    }

    /** Timeouts are kept here and run by hand. */
    static class ManualTimer extends ScheduledThreadPoolExecutor {
        final List<Runnable> tasks = new ArrayList<>();

        ManualTimer() {
            super(1);
        }

        @Override
        public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit) {
            tasks.add(command);
            return null;
        }

        void runAll() {
            List<Runnable> now = new ArrayList<>(tasks);
            tasks.clear();
            now.forEach(Runnable::run);
        }
    }

    long now = 1_000_000;
    final ManualTimer timer = new ManualTimer();
    final RoomService rooms = new RoomService(timer, () -> now);

    void msg(FakePeer p, String json) {
        now += 50;
        rooms.onMessage(p, json);
    }

    String create(FakePeer host, int team) {
        msg(host, "{\"t\":\"create\",\"track\":\"night\",\"team\":" + team + "}");
        return host.last("room").path("code").asText();
    }

    @Test
    void createMakesARoomWithTheCreatorAsHost() {
        FakePeer host = new FakePeer();
        String code = create(host, 2);
        JsonNode room = host.last("room");
        assertEquals(5, code.length());
        assertEquals("night", room.path("track").asText());
        assertEquals("lobby", room.path("state").asText());
        assertEquals(room.path("you").asInt(), room.path("host").asInt());
        assertEquals(2, room.path("players").get(0).path("team").asInt());
    }

    @Test
    void unknownTracksAreRefused() {
        FakePeer host = new FakePeer();
        msg(host, "{\"t\":\"create\",\"track\":\"moon\",\"team\":0}");
        assertEquals("badtrack", host.last("err").path("e").asText());
        assertEquals(0, rooms.roomCount());
    }

    @Test
    void aTakenTeamIsDroppedOnJoinAndCannotBeChosen() {
        FakePeer host = new FakePeer(), guest = new FakePeer();
        String code = create(host, 3);
        msg(guest, "{\"t\":\"join\",\"code\":\"" + code.toLowerCase() + "\",\"team\":3}");
        JsonNode room = guest.last("room");
        assertEquals(2, room.path("players").size());
        assertTrue(room.path("players").get(1).path("team").isNull());

        msg(guest, "{\"t\":\"team\",\"team\":3}");
        assertEquals("team", guest.last("err").path("e").asText());
        msg(guest, "{\"t\":\"team\",\"team\":4}");
        assertEquals(4, host.last("room").path("players").get(1).path("team").asInt());
    }

    @Test
    void joinFailsForMissingFullOrStartedRooms() {
        FakePeer p = new FakePeer();
        msg(p, "{\"t\":\"join\",\"code\":\"ZZZZZ\",\"team\":0}");
        assertEquals("notfound", p.last("err").path("e").asText());

        FakePeer host = new FakePeer();
        String code = create(host, 0);
        List<FakePeer> guests = new ArrayList<>();
        for (int k = 1; k < RoomService.MAX_PLAYERS; k++) {
            FakePeer g = new FakePeer();
            guests.add(g);
            msg(g, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":" + k + "}");
        }
        FakePeer seventh = new FakePeer();
        msg(seventh, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":0}");
        assertEquals("full", seventh.last("err").path("e").asText());

        msg(guests.get(0), "{\"t\":\"leave\"}");
        msg(host, "{\"t\":\"start\"}");
        FakePeer late = new FakePeer();
        msg(late, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":1}");
        assertEquals("started", late.last("err").path("e").asText());
    }

    @Test
    void aFullRaceRelaysStatesAndGoesBackToTheLobby() {
        FakePeer host = new FakePeer(), guest = new FakePeer();
        String code = create(host, 0);
        msg(guest, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":1}");
        msg(guest, "{\"t\":\"start\"}"); // only the host can start
        assertEquals(0, guest.count("intro"));
        msg(host, "{\"t\":\"start\"}");
        assertEquals(1, guest.count("intro"));
        assertEquals("intro", guest.last("room").path("state").asText());

        msg(host, "{\"t\":\"ready\"}");
        assertEquals(0, host.count("go"));
        msg(guest, "{\"t\":\"ready\"}");
        assertEquals(1, host.count("go"));
        assertEquals(1, guest.count("go"));

        msg(host, "{\"t\":\"s\",\"x\":1.5,\"p\":20}");
        JsonNode s = guest.last("s");
        assertEquals(1.5, s.path("x").asDouble());
        assertEquals(host.last("room").path("you").asInt(), s.path("id").asInt());
        assertNull(host.last("s")); // never back to the sender

        msg(host, "{\"t\":\"fin\",\"time\":101.25}");
        assertEquals(101.25, guest.last("fin").path("time").asDouble());
        assertEquals("race", guest.last("room").path("state").asText());
        msg(guest, "{\"t\":\"fin\",\"time\":103}");
        assertEquals("lobby", guest.last("room").path("state").asText());
    }

    @Test
    void theRaceNeedsAtLeastTwoPlayers() {
        FakePeer host = new FakePeer();
        create(host, 5);
        msg(host, "{\"t\":\"start\"}");
        assertEquals("alone", host.last("err").path("e").asText());
        assertEquals(0, host.count("intro"));
    }

    @Test
    void theIntroTimesOutForPlayersWhoNeverFinishTheDialogue() {
        FakePeer host = new FakePeer(), guest = new FakePeer();
        String code = create(host, 0);
        msg(guest, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":1}");
        msg(host, "{\"t\":\"start\"}");
        msg(host, "{\"t\":\"ready\"}");
        timer.runAll();
        assertEquals(1, guest.count("go"));
        // the race has its own timeout, which sends everyone back to the lobby
        timer.runAll();
        assertEquals(1, guest.count("go"));
        assertEquals("lobby", guest.last("room").path("state").asText());
    }

    @Test
    void whenTheHostLeavesTheNextPlayerTakesOverAndEmptyRoomsClose() {
        FakePeer host = new FakePeer(), guest = new FakePeer();
        String code = create(host, 0);
        msg(guest, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":1}");
        int guestId = guest.last("room").path("you").asInt();
        rooms.onClose(host);
        assertEquals(guestId, guest.last("room").path("host").asInt());
        assertEquals(1, guest.count("left"));
        assertEquals(1, rooms.roomCount());
        rooms.onClose(guest);
        assertEquals(0, rooms.roomCount());
    }

    @Test
    void floodsAndIdleRoomsAreHandled() {
        FakePeer host = new FakePeer(), guest = new FakePeer();
        String code = create(host, 0);
        msg(guest, "{\"t\":\"join\",\"code\":\"" + code + "\",\"team\":1}");
        msg(host, "{\"t\":\"start\"}");
        msg(host, "{\"t\":\"ready\"}");
        msg(guest, "{\"t\":\"ready\"}");
        int before = guest.got.size();
        for (int k = 0; k < 100; k++) {
            rooms.onMessage(host, "{\"t\":\"s\",\"x\":" + k + "}");
        }
        assertTrue(guest.got.size() - before <= RoomService.MAX_PER_SECOND);

        now += RoomService.IDLE_MS + 1;
        rooms.sweep();
        assertEquals(0, rooms.roomCount());
        assertTrue(host.closed);
        assertFalse(guest.last("closed") == null);
    }
}
