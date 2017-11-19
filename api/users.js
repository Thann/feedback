// REST API for users.
'use strict';

const db = require('../lib/db');
const crypto = require('crypto');
// const errors = require('../lib/errors');
const helpers = require('../lib/helpers');

module.exports = function(app) {
	app.  post('/auth', auth);
	app.delete('/auth', logout);
	app.   get('/users', index);
	app.  post('/users', create);
	app.   get('/users/:username', read);
	app. patch('/users/:username', update);
	app.delete('/users/:username', remove);
	app.   get('/users/:username/logs', logs);
};

async function auth(request, response) {
	if (!request.body.username || !request.body.password) {
		return response.status(400)
			.send({username: 'required', password: 'required'});
	}
	const user = await db.get('SELECT * FROM users WHERE username = ?',
		request.body.username);
	const password = request.body.password;
	if (user) {
		// Empty salt mean unhashed password
		if ((!user.pw_salt && password === user.password_hash) ||
				(crypto.createHash('sha256', user.pw_salt)
					.update(password).digest('hex') === user.password_hash)) {
			const sesh = crypto.createHash('sha256')
				.update(Math.random().toString()).digest('hex');

			await db.run(`
				UPDATE users
				SET session_cookie = ? , session_created = CURRENT_TIMESTAMP
				WHERE id = ?`,
				sesh, user.id);

			response.set('Set-Cookie',
				'Session='+sesh+'; HttpOnly; Max-Age=2592000');
			return response.send({
				id: user.id,
				username: user.username,
				requires_reset: !user.pw_salt,
				last_login: user.session_created,
			});
		}
	}
	response.status(400).send({error: 'incorrect username or password'});
}

async function logout(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (user) {
		await db.run('UPDATE users SET session_cookie = NULL WHERE id = ?',
			user.id);
		response.set('Set-Cookie', 'Session=; HttpOnly');
		return response.status(204).end();
	}
	response.status(401).end();
}

async function index(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (!user.admin) {
		return response.status(403).send({error: 'must be admin'});
	}

	const users = await db.all(`
		SELECT users.*, '['||
			GROUP_CONCAT( '{'||
				'"id":'          || permissions.door_id ||','||
				'"creation":"'   || IFNULL(permissions.creation, '') ||'",'||
				'"expiration":"' || IFNULL(permissions.expiration, '') ||'",'||
				'"constraints":"'|| IFNULL(permissions.constraints, '') ||'"'||
			'}' ) ||']' AS doors FROM users
		LEFT JOIN permissions ON users.id = permissions.user_id
		GROUP BY users.id`);

	const userList = [];
	for (const usr of users) {
		userList.push({
			id: usr.id,
			doors: JSON.parse(usr.doors) || [],
			admin: Boolean(usr.admin),
			username: usr.username,
			password: usr.pw_salt? undefined : usr.password_hash,
			requires_reset: !usr.pw_salt,
		});
	}
	response.send(userList);
}

async function create(request, response) {
	if (!request.body.username) {
		return response.status(400)
			.send({username: 'required'});
	}

	const user = await helpers.check_cookie(request, response);
	if (!user.admin) {
		return response.status(403).send({error: 'must be admin'});
	}

	// Give the user a random un-hashed password
	const pw = crypto.createHash('sha256')
		.update(Math.random().toString()).digest('hex').substring(1, 15);

	let sqlResp;
	try {
		sqlResp = await db.run(
			'INSERT INTO users (username, password_hash, admin) VALUES (?,?,?)',
			request.body.username, pw, Boolean(request.body.admin));
	} catch(e) {
		return response.status(400)
			.send({username: 'already taken'});
	}

	response.send({
		id: sqlResp.stmt.lastID,
		admin: Boolean(request.body.admin),
		username: request.body.username,
		password: pw,
		requires_reset: true,
	});
}

async function read(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403)
			.send({error: 'only admins can view others'});
	}

	const usr = await db.get(`
		SELECT users.*, '['||
			GROUP_CONCAT( '{'||
				'"id":'          || permissions.door_id ||','||
				'"creation":"'   || IFNULL(permissions.creation, '') ||'",'||
				'"expiration":"' || IFNULL(permissions.expiration, '') ||'",'||
				'"constraints":"'|| IFNULL(permissions.constraints, '') ||'"'||
			'}' ) ||']' AS doors FROM users
		LEFT JOIN permissions ON users.id = permissions.user_id
		WHERE username = ?`,
		request.params.username);

	if (!usr.id) {
		return response.status(404).end();
	}
	response.send({
		id: usr.id,
		doors: JSON.parse(usr.doors) || [],
		admin: Boolean(usr.admin),
		username: usr.username,
		password: user.admin && usr.pw_salt? undefined : usr.password_hash,
		requires_reset: !usr.pw_salt,
	});
}

async function update(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (!user.admin && (
		!request.body.password || request.body.password.length < 8)) {
		return response.status(400)
			.send({password: 'must be at least 8 characters'});
	}

	// console.log("Update_USER", user, request.params.username, user.username)
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403)
			.send({error: 'can only update your own info'});
	}

	if (!user.admin && request.body.admin) {
		return response.status(403).send({error: "can't make yourself admin"});
	}
	//TODO: update username and stuff. (PUT?)

	let salt, pwHash = null;
	if (request.params.username !== user.username) {
		// var salt = null;
		if (request.body.password) {
			pwHash = request.body.password;
		} else {
			pwHash = crypto.createHash('sha256')
				.update(Math.random().toString())
				.digest('hex').substring(1, 15);
		}
	} else {
		if (user.pw_salt && (!request.current_password ||
							crypto.createHash('sha256', user.pw_salt)
								.update(request.body.current_password)
								.digest('hex') !== user.password_hash)) {
			return response.status(400)
				.send({current_password: 'incorrect password'});
		}
		salt = crypto.createHash('sha256')
			.update(Math.random().toString()).digest('hex');
		pwHash = crypto.createHash('sha256', salt)
			.update(request.body.password).digest('hex');
	}

	try {
		// const r = await db.run(`
		await db.run(`
			UPDATE users SET pw_salt = ? , password_hash = ?
			WHERE username = ?`,
			salt, pwHash, request.params.username);
		// console.log("UPDATE:", r)
	} catch(e) {
		return response.status(400).send({error: 'DB update error'});
	}

	const usr = await db.get(`
		SELECT users.*, '['||
			GROUP_CONCAT( '{'||
				'"id":'          || permissions.door_id ||','||
				'"creation":"'   || IFNULL(permissions.creation, '') ||'",'||
				'"expiration":"' || IFNULL(permissions.expiration, '') ||'",'||
				'"constraints":"'|| IFNULL(permissions.constraints, '') ||'"'||
			'}' ) ||']' AS doors FROM users
		LEFT JOIN permissions ON users.id = permissions.user_id
		WHERE username = ?`,
		request.params.username);

	response.send({
		id: usr.id,
		doors: JSON.parse(usr.doors) || [],
		admin: Boolean(usr.admin),
		username: usr.username,
		password: user.admin && usr.pw_salt? undefined : usr.password_hash,
		requires_reset: !usr.pw_salt,
	});
}

async function remove(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (!user.admin) {
		return response.status(403).send({error: 'must be admin'});
	}
	const r = await db.run(
		'DELETE FROM users WHERE username = ?',
		request.params.username);
	response.status(r.stmt.changes? 204 : 404).end();
}

async function logs(request, response) {
	const user = await helpers.check_cookie(request, response);
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403).send({error: 'must be admin'});
	}

	let lastID;
	try {
		lastID = parseInt(request.query.last_id);
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	const logs = await db.all(`
		SELECT entry_logs.*, doors.name AS door FROM entry_logs
		INNER JOIN users ON entry_logs.user_id = users.id
		INNER JOIN doors ON entry_logs.door_id = doors.id
		WHERE users.username = ? AND entry_logs.id < COALESCE(?, 9e999)
		ORDER BY entry_logs.id DESC LIMIT ?`,
		request.params.username, lastID, 50);

	response.send(logs);
}
