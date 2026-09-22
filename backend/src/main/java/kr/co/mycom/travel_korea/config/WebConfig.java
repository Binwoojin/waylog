package kr.co.mycom.travel_korea.config;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    public final String frontendOrigin;

    public WebConfig(@Value("${app.cors.frontend-origin:http://localhost:5173}") String frontendOrigin) {
        this.frontendOrigin = frontendOrigin;
    }
    public void addCorsMappings(CorsRegistry registry)   {
        registry.addMapping("/**")
                .allowedOrigins(frontendOrigin)
                .allowedMethods("*")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

    }


}
