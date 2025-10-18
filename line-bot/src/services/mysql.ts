/*
CREATE USER 'smart-farm-steward'@'%' IDENTIFIED WITH sha256_password BY '***';GRANT USAGE ON *.* TO 'smart-farm-steward'@'%';ALTER USER 'smart-farm-steward'@'%' REQUIRE NONE WITH MAX_QUERIES_PER_HOUR 0 MAX_CONNECTIONS_PER_HOUR 0 MAX_UPDATES_PER_HOUR 0 MAX_USER_CONNECTIONS 0;CREATE DATABASE IF NOT EXISTS `smart-farm-steward`;GRANT ALL PRIVILEGES ON `smart-farm-steward`.* TO 'smart-farm-steward'@'%';

    CREATE TABLE line_users (
        user_id VARCHAR(50) NOT NULL PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        picture_url VARCHAR(255),
        status_message VARCHAR(255),
        language VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
*/