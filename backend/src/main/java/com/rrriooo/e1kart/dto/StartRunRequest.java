package com.rrriooo.e1kart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record StartRunRequest(@Min(0) @Max(5) int team) {
}
