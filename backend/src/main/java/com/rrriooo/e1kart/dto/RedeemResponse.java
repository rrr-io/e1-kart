package com.rrriooo.e1kart.dto;

import java.time.LocalDateTime;

/**
 * kind: FANS_CHOICE or MCD; track: the game track the runs are for ("space", "bloody");
 * balance: the runs left for that track.
 */
public record RedeemResponse(int runsAdded, long balance, LocalDateTime participationAt, String category, String kind, String track) {
}
