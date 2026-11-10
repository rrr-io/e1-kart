package com.rrriooo.e1kart.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Voting between several OCR readings of the certificate ID, ported from the collab verifier (collab.py).
 * <p>
 * The ID font is tightly spaced: a single reading can glue "No." in front, insert or merge a character.
 * Every reading votes for each 16-character ID it can stand for, so the true ID collects the most votes
 * even when no single reading is right. Look-alike characters (O/0, 1/I, 5/S, 8/B...) are folded together
 * when choosing between candidates. Pure functions, no Spring.
 */
public final class IdVotes {

    private IdVotes() {
    }

    private static final Pattern ID = Pattern.compile("[A-Z0-9]{16}");
    /** Groups overlap on purpose: 9 looks like 0 and like S. */
    private static final String[] CONFUSABLE = {"0OQD9", "1IL", "5S9", "8BS", "2Z", "6G", "A4", "UV"};
    private static final Map<Character, Character> FOLD = classes();

    /** The reading reduced to A-Z0-9, when it has 16 to 18 characters (prefix or a stray character), else null. */
    public static String squash(String text) {
        if (text == null) {
            return null;
        }
        String s = text.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return s.length() >= 16 && s.length() <= 18 ? s : null;
    }

    /** Every 16-character ID a raw reading can stand for: the "No." prefix and stray characters removed in every possible way. */
    static Set<String> forms(String reading) {
        Set<String> out = new LinkedHashSet<>();
        if (reading == null || reading.isEmpty()) {
            return out;
        }
        if (reading.length() > 16 && reading.charAt(0) == 'N') { // "No." read as "N": always a prefix, never part of the ID
            reading = reading.substring(1);
        }
        if (reading.length() == 16) {
            out.add(reading);
            return out;
        }
        if (reading.length() < 16) {
            return out;
        }
        int drop = reading.length() - 16;
        combinations(reading, drop, 0, new int[drop], 0, out);
        return out;
    }

    private static void combinations(String s, int k, int from, int[] chosen, int depth, Set<String> out) {
        if (depth == k) {
            StringBuilder b = new StringBuilder(16);
            int j = 0;
            for (int i = 0; i < s.length(); i++) {
                if (j < k && chosen[j] == i) {
                    j++;
                } else {
                    b.append(s.charAt(i));
                }
            }
            out.add(b.toString());
            return;
        }
        for (int i = from; i < s.length(); i++) {
            chosen[depth] = i;
            combinations(s, k, i + 1, chosen, depth + 1, out);
        }
    }

    /** IDs with the number of readings that can stand for each, best first; ties keep the order of the readings. */
    static List<Map.Entry<String, Integer>> tally(List<String> readings) {
        Map<String, Integer> votes = new LinkedHashMap<>();
        for (String r : readings) {
            for (String f : forms(r)) {
                votes.merge(f, 1, Integer::sum);
            }
        }
        List<Map.Entry<String, Integer>> ranked = new ArrayList<>(votes.entrySet());
        ranked.sort((a, b) -> b.getValue() - a.getValue()); // stable: ties keep the insertion order
        return ranked;
    }

    private static List<String> valid(List<String> readings) {
        List<String> found = new ArrayList<>();
        for (String r : readings) {
            if (r != null && !r.isEmpty()) {
                found.add(r);
            }
        }
        return found;
    }

    /**
     * The ID the readings agree on, or null. The leader needs two votes, more than half of the valid readings
     * and a margin of two over the runner-up (unless every valid reading is identical).
     */
    public static String consensus(List<String> readings) {
        List<String> found = valid(readings);
        List<Map.Entry<String, Integer>> ranked = tally(found);
        if (found.size() < 2 || ranked.isEmpty()) {
            return null;
        }
        String top = ranked.get(0).getKey();
        int votes = ranked.get(0).getValue();
        int runner = ranked.size() > 1 ? ranked.get(1).getValue() : 0;
        if (votes >= 2 && votes * 2 > found.size() && (votes >= runner + 2 || votes == found.size())) {
            return top;
        }
        return null;
    }

    /**
     * The best guess when the readings are not unanimous, or null: a single candidate, a candidate with more votes
     * than any other, or candidates that differ only in look-alike characters. A tie between really different IDs is not guessed.
     */
    public static String unsureGuess(List<String> readings) {
        List<Map.Entry<String, Integer>> ranked = tally(valid(readings));
        if (ranked.isEmpty()) {
            return null;
        }
        String top = ranked.get(0).getKey();
        if (ranked.size() == 1 || ranked.get(0).getValue() > ranked.get(1).getValue()) {
            return top;
        }
        for (Map.Entry<String, Integer> other : ranked) {
            if (!fold(other.getKey()).equals(fold(top))) {
                return null;
            }
        }
        return top;
    }

    /** The candidate with the most votes (the first one on a tie), or null when no reading gives a 16-character ID. */
    public static String bestCandidate(List<String> readings) {
        List<Map.Entry<String, Integer>> ranked = tally(valid(readings));
        return ranked.isEmpty() ? null : ranked.get(0).getKey();
    }

    /** True when the three first readings agree and nothing more is needed. */
    static boolean settled(List<String> readings) {
        if (readings.size() < 3) {
            return false;
        }
        List<Map.Entry<String, Integer>> ranked = tally(valid(readings));
        return !ranked.isEmpty() && ranked.size() == 1 && ranked.get(0).getValue() == valid(readings).size() && ranked.get(0).getValue() >= 3;
    }

    private static Map<Character, Character> classes() {
        List<Set<Character>> classes = new ArrayList<>();
        for (String group : CONFUSABLE) {
            Set<Character> merged = new LinkedHashSet<>();
            for (char c : group.toCharArray()) {
                merged.add(c);
            }
            for (Set<Character> other : new ArrayList<>(classes)) {
                boolean overlap = other.stream().anyMatch(merged::contains);
                if (overlap) {
                    merged.addAll(other);
                    classes.remove(other);
                }
            }
            classes.add(merged);
        }
        Map<Character, Character> fold = new HashMap<>();
        for (Set<Character> c : classes) {
            char min = c.stream().min(Character::compare).orElseThrow();
            for (char ch : c) {
                fold.put(ch, min);
            }
        }
        return fold;
    }

    /** The ID with every look-alike character folded to one representative. */
    public static String fold(String id) {
        StringBuilder b = new StringBuilder();
        for (char c : (id == null ? "" : id).toCharArray()) {
            b.append(FOLD.getOrDefault(c, c));
        }
        return b.toString();
    }

    public static boolean isId(String s) {
        return s != null && ID.matcher(s).matches();
    }
}
