-- UP
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    -- TODO: test unique and delete
    username VARCHAR(255) UNIQUE COLLATE NOCASE,
    pw_salt VARCHAR(255),
    password_hash VARCHAR(255),
    admin BOOLEAN DEFAULT 0,
    session_cookie VARCHAR(255) UNIQUE,
    session_created DATETIME,
    deleted_at DATETIME
);
INSERT into users (username, password_hash, admin) VALUES ('admin', 'admin', 1);

-- CREATE UNIQUE INDEX idx_usernames on users (username)
--     WHERE deleted_at IS NULL;

CREATE TABLE forms (
    id INTEGER PRIMARY KEY,
    hash VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER,
    expiration DATETIME,
    public BOOLEAN,
    data TEXT, -- JSON
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE feedbacks (
    id INTEGER PRIMARY KEY,
    form_hash VARCHAR(255),
    submitter_id INTEGER,
    time DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT, -- JSON
    FOREIGN KEY(submitter_id) REFERENCES users(id),
    FOREIGN KEY(form_hash) REFERENCES forms(hash),
    -- TODO: test
    UNIQUE(form_hash, submitter_id) ON CONFLICT REPLACE
);
-- CREATE UNIQUE INDEX idx_feedbacks on feedbacks (user_id, form_id, submitter_id);
-- CREATE INDEX idx_user_feedbacks on feedbacks (user_id);
-- CREATE INDEX idx_form_feedbacks on feedbacks (form_id);
-- CREATE INDEX idx_submitter_feedbacks on feedbacks (submitter_id);

-- DOWN
DROP TABLE users;
DROP TABLE forms;
DROP TABLE feedbacks;
