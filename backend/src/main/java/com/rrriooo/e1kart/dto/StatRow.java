package com.rrriooo.e1kart.dto;

/** One daily counter, as returned to the stats page. */
public record StatRow(String day, String name, String dim, long count) {
}
