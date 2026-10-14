package com.rrriooo.e1kart.dto;

import java.time.LocalDateTime;

public record RedeemResponse(int runsAdded, long balance, LocalDateTime participationAt, String category) {
}
