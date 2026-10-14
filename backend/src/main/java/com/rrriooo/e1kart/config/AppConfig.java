package com.rrriooo.e1kart.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.rrriooo.e1kart.service.CertificateIdHasher;
import com.rrriooo.e1kart.service.CertificateParser;

@Configuration
public class AppConfig {

    @Bean
    public CertificateParser certificateParser() {
        return new CertificateParser();
    }

    @Bean
    public CertificateIdHasher certificateIdHasher(E1KartProperties props) {
        return new CertificateIdHasher(props.idSecret());
    }
}
