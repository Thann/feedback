-- UP
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    pw_salt VARCHAR(255),
    password_hash VARCHAR(255),
    admin BOOLEAN DEFAULT 0,
    session_cookie VARCHAR(255) UNIQUE,
    session_created DATETIME
);
INSERT into users (username, password_hash, admin) VALUES ('admin', 'admin', 1);

CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY,
    hash VARCHAR(255) UNIQUE,
    visiblity BOOLEAN,
);

CREATE TABLE feedbacks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    campaign_id INTEGER,
    submitter_id INTEGER,
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(submitter_id) REFERENCES users(id),
    UNIQUE (user_id, campaign_id, submitter_id) ON CONFLICT REPLACE
);
-- CREATE UNIQUE INDEX idx_feedbacks on feedbacks (user_id, campaign_id, submitter_id);
-- CREATE INDEX idx_user_feedbacks on feedbacks (user_id);
-- CREATE INDEX idx_campaign_feedbacks on feedbacks (campaign_id);
-- CREATE INDEX idx_submitter_feedbacks on feedbacks (submitter_id);

-- DOWN
DROP TABLE users;
DROP TABLE campaigns;
DROP TABLE feedbacks;
