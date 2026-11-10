package com.rrriooo.e1kart.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** The ID-voting cases of the collab verifier's tests (test_collab.py), on the Java port. */
class IdVotesTest {

    private static final String A = "61101EL66DVW4LYL", B = "61101EL66DVWALYL";

    @Test
    void consensusNeedsAgreementAndAMargin() {
        assertEquals(A, IdVotes.consensus(List.of(A, A)));
        assertEquals(A, IdVotes.consensus(Arrays.asList(A, null, A, null, A)));
        assertEquals(A, IdVotes.consensus(List.of(A, A, A, B)));        // clear majority
        assertNull(IdVotes.consensus(List.of(A, B)));                  // disagreement
        assertNull(IdVotes.consensus(List.of(A, A, B, B)));
        assertNull(IdVotes.consensus(List.of(A, A, B)));               // only a margin of one
        assertNull(IdVotes.consensus(Arrays.asList(A, null, null)));   // a single reading is never enough
    }

    @Test
    void strayCharactersAndPrefixAreVotedAway() {
        // real readings of 61101BRL9IMZRU9F: "No." glued in front, characters inserted or replaced
        List<String> raw = Arrays.asList("N61101BRL9IMZRU9SF", "N61101BRL9IMZRU9F", "N61101BRL9OIMZRUSF", "N61101BRL9IMZRU9OF",
                "N61101BRL9IMZRU9F", "N61101BRL9IMZRUSF", null, "N61101BRL9OIMZRU9F");
        assertEquals("61101BRL9IMZRU9F", IdVotes.consensus(raw));
        assertEquals("61105JDXSVKA6VXC", IdVotes.consensus(List.of("N61105JDXSVKA6VXC", "N61105JDXSVKA6VXC", "N61105JDXSVKA6VXC")));
    }

    @Test
    void nineAndZeroAreLookAlikes() {
        assertEquals("61105JDXSVKA6VX0", IdVotes.unsureGuess(List.of("61105JDXSVKA6VX0", "61105JDXSVKA6VX9")));
        assertEquals("61105JDXSVKA6VX9", IdVotes.unsureGuess(List.of("61105JDXSVKA6VX9", "61105JDXSVKA6VXS")));
        assertNull(IdVotes.unsureGuess(List.of("61105JDXSVKA6VXK", "61105JDXSVKA6VX9")));
    }

    @Test
    void weakReadingsGiveAGuessOnlyWithALeader() {
        assertEquals("61101BRL9IMZRU9F", IdVotes.unsureGuess(Arrays.asList("N61101BRL9IMZRU9F", null, "N61101BRL9IMZRUSF", "N61101BRL9IMZRU9F")));
        assertNull(IdVotes.unsureGuess(List.of("CCCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCCK"))); // a tie between different IDs
        assertNull(IdVotes.unsureGuess(Arrays.asList(null, null)));
    }

    @Test
    void squashKeepsReadingsOfSixteenToEighteenCharacters() {
        assertEquals("NO61105JDXSVKA6VXC", IdVotes.squash("No. 61105JDXSVKA6VXC\n"));
        assertNull(IdVotes.squash("61105JDXSVKA6VX"));
    }

    @Test
    void withoutAgreementTheCandidateWithMostVotesIsUsed() {
        assertEquals("CCCCCCCCCCCCCCCC", IdVotes.bestCandidate(List.of("CCCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCCK"))); // a tie: the first
        assertNull(IdVotes.bestCandidate(Arrays.asList(null, "SHORT")));
    }
}
