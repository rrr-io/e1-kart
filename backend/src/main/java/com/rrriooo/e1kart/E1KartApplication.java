package com.rrriooo.e1kart;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class E1KartApplication {

    public static void main(String[] args) throws IOException {
        // SQLite doesn't create the database file's folder: we create it before starting Spring.
        Path db = Path.of(System.getenv().getOrDefault("E1KART_DB_PATH", "./data/e1kart.db")).toAbsolutePath();
        if (db.getParent() != null) {
            Files.createDirectories(db.getParent());
        }
        SpringApplication.run(E1KartApplication.class, args);
    }
}
