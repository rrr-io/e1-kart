package com.rrriooo.e1kart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** team: 0..5. track: the game's track id ("space", "bloody"); missing means Interstellar (older versions). */
public record StartRunRequest(@Min(0) @Max(5) int team, @Size(max = 16) String track) {
}
