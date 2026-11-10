package com.rrriooo.e1kart.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Anonymous usage counter: how many times an event happened on a day, e.g. ("2026-11-12", "visit", "instagram") = 42.
 * Only totals are stored: no IP, no player, no timestamp of the single event.
 */
@Entity
@Table(name = "stat_counter", uniqueConstraints = @UniqueConstraint(name = "uq_stat_counter", columnNames = {"day", "name", "dim"}))
public class StatCounter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Day in the stats time zone, as yyyy-MM-dd. */
    @Column(nullable = false, length = 10)
    private String day;

    @Column(nullable = false, length = 32)
    private String name;

    @Column(nullable = false, length = 64)
    private String dim;

    @Column(nullable = false)
    private long count;

    protected StatCounter() {
    }

    public String getDay() {
        return day;
    }

    public String getName() {
        return name;
    }

    public String getDim() {
        return dim;
    }

    public long getCount() {
        return count;
    }
}
