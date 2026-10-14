package com.rrriooo.e1kart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Total race time: between 20 seconds and 30 minutes; outside this range it's definitely bogus. */
public record FinishRunRequest(@Min(20_000) @Max(1_800_000) long timeMs) {
}
