package com.rrriooo.e1kart.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.rrriooo.e1kart.model.StatCounter;

public interface StatCounterRepository extends JpaRepository<StatCounter, Long> {

    /** +1 on the counter, created at 1 the first time (SQLite upsert on the unique day/name/dim). */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO stat_counter(day, name, dim, count) VALUES (:day, :name, :dim, 1) "
            + "ON CONFLICT(day, name, dim) DO UPDATE SET count = count + 1", nativeQuery = true)
    void bump(@Param("day") String day, @Param("name") String name, @Param("dim") String dim);

    List<StatCounter> findByDayGreaterThanEqualOrderByDayAsc(String fromDay);
}
