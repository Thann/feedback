// REST API for users.
'use strict';

const db = require('../lib/db');
const crypto = require('crypto');
const cookie = require('cookie');
const errors = require('../lib/errors');
const MemCache = require('../lib/memcache');

module.exports = function(app) {
	app.  post('/auth', auth);
	app.delete('/auth', logout);
	app.   get('/users', index);
	app.  post('/users', create);
	app.   get('/users/:username', read);
	app. patch('/users/:username', update);
	app.delete('/users/:username', remove);
	app.delete('/users/:username/forms', forms);
	app.delete('/users/:username/feedbacks', feedbacks);
};

// Returns the user that owns the session cookie
const checkCookie = async function(request, response) {
	let sesh;
	try {
		sesh = cookie.parse(request.headers.cookie).Session;
		// console.log("GET:", request.path)
	} catch (e) {
		// console.warn("ERROR Processing Cookie:", e);
		response.clearCookie('Session');
		response.status(401).send({error: 'session cookie malformed'});
		throw new errors.HandledError();
	}
	const user = await db.get(`
		SELECT * FROM users WHERE session_cookie = ?
		AND datetime(session_created, '+1 month') >= CURRENT_TIMESTAMP`,
		sesh);
	if (!user || sesh.length < 5) {
		response.clearCookie('Session');
		response.status(401).end();
		throw new errors.HandledError();
	}
	return user;
};
module.exports.checkCookie = checkCookie;

const site = require('./site');  //TODO: remove circular require.
const userAuthRates = new MemCache();

// === API ===

async function auth(request, response) {
	if (!request.body.username || !request.body.password) {
		return response.status(400)
			.send({username: 'required', password: 'required'});
	}
	//TODO: rate-limit by ip address also.
	if (userAuthRates.get(request.body.username) >=
		site.privateSettings['auth_attempts_per_hour']) {
		return response.status(429)
			.send({error: 'too many auth attempts'});
	}
	const user = await db.get('SELECT * FROM users WHERE username = ?',
		request.body.username);
	const password = request.body.password;
	if (user) {
		// Empty salt mean unhashed password
		if ((!user.pw_salt && password === user.password_hash) ||
				(crypto.createHash('sha256', user.pw_salt)
					.update(password).digest('hex') === user.password_hash)) {
			userAuthRates.set(user.username);

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

		const rl = userAuthRates.get(user.username) || 0;
		userAuthRates.set(user.username, rl + 1, !rl && 60*60*1000);
	}
	response.status(400).send({error: 'incorrect username or password'});
}

async function logout(request, response) {
	const user = await checkCookie(request, response);
	if (user) {
		await db.run('UPDATE users SET session_cookie = NULL WHERE id = ?',
			user.id);
		response.clearCookie('Session');
		return response.status(204).end();
	}
	response.status(401).end();
}

async function index(request, response) {
	const user = await checkCookie(request, response);
	if (!user.admin) {
		return response.status(403).send({error: 'must be admin'});
	}

	const users = await db.all('SELECT * FROM users');

	// TODO: generator!
	const userList = [];
	for (const usr of users) {
		userList.push({
			id: usr.id,
			admin: Boolean(usr.admin),
			username: usr.username,
			password: usr.pw_salt? undefined : usr.password_hash,
			requires_reset: !usr.pw_salt,
		});
	}
	response.send(userList);
}

async function create(request, response) {
	const username = request.body.username;
	if (!username)
		return response.status(400).send({username: 'required'});
	if (!username.match(/^\w+$/) || username === 'me')
		return response.status(400).send({username: 'invalid'});

	let invite, salt, pw, admin;
	const user = await checkCookie(request, response);

	if (!user.admin) {
		if (!request.body.invite)
			return response.status(403).send({error: 'must have invite'});
		invite = site.pendingInvites.get(request.body.invite);
		if (!invite)
			return response.status(400)
				.send({error: 'invalid or expired invite'});
		if (request.body.password) {
			if (request.body.password.length < 8)
				return response.status(400)
					.send({password: 'must be at least 8 characters'});
			salt = crypto.createHash('sha256')
				.update(Math.random().toString()).digest('hex');
			pw = crypto.createHash('sha256', salt)
				.update(request.body.password).digest('hex');
		}
	} else {
		pw = request.body.password;
		admin = Boolean(request.body.admin);
		//TODO: use bitfield
		// try {
		// 	admin = parseInt(request.body.admin);
		// } catch(e) {
		// 	return response.status(400).send({admin: 'must be int'});
		// }
	}

	// Default password to random hash.
	pw = pw || (crypto.createHash('sha256')
		.update(Math.random().toString()).digest('hex').substring(1, 15));

	let sqlResp;
	try {
		sqlResp = await db.run(`
			INSERT INTO users (username, pw_salt, password_hash, admin)
			VALUES (?,?,?,?)`,
			username, salt, pw, admin);
	} catch(e) {
		// console.warn('USER UPDATE ERROR:', e);
		return response.status(400)
			.send({username: 'already taken'});
	}

	//TODO: create invite permissions.

	response.send({
		id: sqlResp.stmt.lastID,
		admin: Boolean(request.body.admin),
		username: request.body.username,
		password: pw,
		requires_reset: true,
	});
}

async function read(request, response) {
	const user = await checkCookie(request, response);
	if (request.params.username === 'me')
		request.params.username = user.username;
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403)
			.send({error: 'only admins can view others'});
	}

	const usr = await db.get(`
		SELECT * FROM users WHERE username = ?`,
		request.params.username);

	if (!usr.id) {
		return response.status(404).end();
	}
	response.send({
		id: usr.id,
		admin: Boolean(usr.admin),
		username: usr.username,
		password: user.admin && !usr.pw_salt && usr.password_hash || undefined,
		requires_reset: !usr.pw_salt,
	});
}

async function update(request, response) {
	const user = await checkCookie(request, response);
	if (request.params.username === 'me')
		request.params.username = user.username;
	if (!user.admin && (
		request.body.password && request.body.password.length < 8)) {
		return response.status(400)
			.send({password: 'must be at least 8 characters'});
	}

	// console.log("Update_USER", user, request.params.username, user.username)
	const sameUser = (request.params.username === user.username);
	if (!sameUser && !user.admin) {
		return response.status(403)
			.send({error: 'can only update your own info'});
	}
	if (!sameUser && request.body.keycode !== undefined) {
		return response.status(403)
			.send({keycode: 'can only update your own keycode'});
	}

	if (!user.admin && request.body.admin) {
		return response.status(403).send({error: "can't make yourself admin"});
	}

	const values = {};
	for (const k of ['admin']) {
		if (request.body[k] !== undefined)
			values[k] = request.body[k];
	}

	if (!sameUser && request.body.password !== undefined) {
		values.pw_salt = null;
		if (request.body.password) {
			values.password_hash = request.body.password;
		} else {
			values.password_hash = crypto.createHash('sha256')
				.update(Math.random().toString())
				.digest('hex').substring(1, 15);
		}
	} else if (request.body.password) {
		if (user.pw_salt && (!request.body.current_password ||
							crypto.createHash('sha256', user.pw_salt)
								.update(request.body.current_password)
								.digest('hex') !== user.password_hash)) {
			return response.status(400)
				.send({current_password: 'incorrect password'});
		}
		values.pw_salt = crypto.createHash('sha256')
			.update(Math.random().toString()).digest('hex');
		values.password_hash = crypto.createHash('sha256', values.pw_salt)
			.update(request.body.password).digest('hex');
	}

	try {
		await db.update('users', values, 'username = ?',
			request.params.username);
	} catch(e) {
		console.warn('USER UPDATE ERROR:', e);
		return response.status(400).send({error: 'DB update error'});
	}

	const usr = await db.get(`
		SELECT * FROM users WHERE username = ? AND deleted_at IS NULL`,
		request.params.username);

	response.send({
		id: usr.id,
		doors: JSON.parse(usr.doors) || [],
		admin: Boolean(usr.admin),
		username: usr.username,
		password: user.admin && !usr.pw_salt && usr.password_hash || undefined,
		requires_reset: !usr.pw_salt,
	});
}

async function remove(request, response) {
	const user = await checkCookie(request, response);
	// if (request.params.username === 'me')
	// 	request.params.username = user.username;
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403).send({error: 'only admins can delete others'});
	}

	//TODO: use ON DELETE CASCADE instead?
	//TODO: expire campiagns
	await db.run(`
		UPDATE users SET deleted_at = CURRENT_TIMESTAMP, session_cookie = NULL
		WHERE username = ? AND deleted_at IS NULL`,
		request.params.username);

	response.status(r.stmt.changes? 204 : 404).end();
}

async function forms(request, response) {
	const user = await checkCookie(request, response);
	if (request.params.username === 'me')
		request.params.username = user.username;
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403)
			.send({error: 'only admins can view others'});
	}

	let lastID;
	try {
		lastID = parseInt(request.query.last_id);
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	const camps = await db.all(`
		SELECT * FROM forms
		WHERE user_id = ? AND id < COALESCE(?, 9e999)
		ORDER BY id DESC LIMIT ?`,
		user.id, lastID, 50);

	response.send(camps);
}

async function feedbacks(request, response) {
	const user = await checkCookie(request, response);
	if (request.params.username === 'me')
		request.params.username = user.username;
	if (!user.admin && request.params.username !== user.username) {
		return response.status(403)
			.send({error: 'only admins can view others'});
	}

	let lastID;
	try {
		lastID = parseInt(request.query.last_id || 0); //TODO: add "|| 0" to other places?
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	const camps = await db.all(`
		SELECT * FROM feedbacks
		WHERE user_id = TRUE AND id < COALESCE(?, 9e999)
		ORDER BY id DESC LIMIT ?`,
		lastID, 50);

	response.send(camps);
}
