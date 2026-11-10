package com.rrriooo.e1kart.dto;

/** An event sent by the game: name (e.g. "race_start") and one detail (e.g. "night:hoonrari"). */
public record StatEventRequest(String name, String dim) {
}
