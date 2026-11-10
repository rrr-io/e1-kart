package com.rrriooo.e1kart.dto;

/** A team in the standings: team index (0..5) and its place, null while the team has no races. */
public record StandingRow(int team, Integer rank) {
}
