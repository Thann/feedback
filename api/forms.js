// REST API for users.
'use strict';

const db = require('../lib/db');
const users = require('./users');
const crypto = require('crypto');

module.exports = function(app) {
	app.   get('/forms', index); // public
	app.  post('/forms', create);
	app.   get('/forms/:hash', read);
	app. patch('/forms/:hash', update);
	app.delete('/forms/:hash', expire);
	app.   get('/forms/:hash/feedbacks', feedbacks);
	app.  post('/forms/:hash/feedbacks', submitFeedback);
};

// === API ===

async function index(request, response) {
	let lastID;
	try {
		lastID = parseInt(request.query.last_id);
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	// TODO: cache
	const forms = await db.all(`
		SELECT forms.*, users.username, COUNT(feedbacks.id) as fbs FROM forms
		LEFT JOIN users ON forms.user_id = users.id
		LEFT JOIN feedbacks ON forms.hash = feedbacks.form_hash
		WHERE public != 0
			AND forms.id < COALESCE(?, 9e999)
			AND (expiration IS NULL OR expiration > CURRENT_TIMESTAMP)
			AND users.deleted_at IS NULL
		GROUP BY forms.id ORDER BY id DESC LIMIT ?`,
		lastID, 50);

	response.send(forms.map(form => ({
		hash: form.hash,
		feedbacks: form.fbs,
		owner: form.username,
		expiration: form.expiration,
		data: JSON.parse(form.data),
		public: Boolean(form.public),
	})));
}

async function create(request, response) {
	const user = await users.checkCookie(request, response);

	// TODO: fancier encoding?
	const hash = (crypto.createHash('sha256')
		.update(Math.random().toString()).digest('hex').substring(1, 15));

	// Data can be string or object
	let data = request.body.data;
	data = typeof data === 'object' && JSON.stringify(data) || data;

	await db.run(`
		INSERT INTO forms (hash, user_id, expiration, public, data)
		VALUES (?,?,?,?,?)`,
		hash, user.id, request.body.expiration, request.body.public, data);

	response.send({
		hash,
		feedbacks: 0,
		owner: user.username,
		data: JSON.parse(data),
		expiration: request.body.expiration || null,
		public: Boolean(request.body.public),
	});
}

async function read(request, response) {
	// TODO: user_deleted_at ?
	const form = await db.get(`
		SELECT forms.*, users.username, COUNT(feedbacks.id) AS fbs FROM forms
		LEFT JOIN users ON forms.user_id = users.id
		LEFT JOIN feedbacks ON forms.hash = feedbacks.form_hash
		WHERE hash = ?`,
		request.params.hash);

	if (!form.id) {
		return response.status(404).end();
	}
	response.send({
		hash: form.hash,
		feedbacks: form.fbs,
		owner: form.username,
		expiration: form.expiration,
		data: JSON.parse(form.data),
		public: Boolean(form.public),
	});
}

// WARNING: updating forms can break feedbacks!
async function update(request, response) {
	const user = await users.checkCookie(request, response);

	const values = {};
	for (const k of ['expiration', 'public', 'data']) {
		if (request.body[k] !== undefined)
			values[k] = request.body[k];
	}
	if (!Object.keys(values).length) {
		return response.status(400).send({error: 'nothing to update'});
	}

	let sqlResp;
	try {
		if (user.admin)
			sqlResp = await db.update('forms', values, 'hash = ?',
				request.params.hash);
		else
			sqlResp = await db.update('forms', values,
				'hash = ? AND user_id = ?',
				request.params.hash, user.id);
	} catch(e) {
		console.warn('FORM UPDATE ERROR:', e);
		return response.status(400).send({error: 'DB update error'});
	}

	if (!sqlResp.changes) {
		return response.status(404).end();
	}

	const form = await db.get(`
		SELECT forms.*, users.username, COUNT(feedbacks.id) AS fbs FROM forms
		LEFT JOIN users ON forms.user_id = users.id
		LEFT JOIN feedbacks ON forms.hash = feedbacks.form_hash
		WHERE hash = ?`,
		request.params.hash);

	response.send({
		hash: form.hash,
		feedbacks: form.fbs,
		owner: form.username,
		expiration: form.expiration,
		data: JSON.parse(form.data),
		public: Boolean(form.public),
	});
}

// paranoid delete
async function expire(request, response) {
	const user = await users.checkCookie(request, response);
	const r = await db.run(`
		UPDATE forms
		SET expiration = CURRENT_TIMESTAMP
		WHERE hash = ?
			AND (user_id = ? OR ? > 0)
			AND (expiration IS NULL OR expiration < CURRENT_TIMESTAMP)
		`,
		request.params.hash, user.id, user.admin);
	response.status(r.stmt.changes? 204 : 404).end();
}

// Lists all feedbacks for a form (owner/admin only)
async function feedbacks(request, response) {
	const user = await users.checkCookie(request, response);

	let lastID;
	try {
		lastID = parseInt(request.query.last_id);
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	const formOwner = await db.get(
		'SELECT * FROM forms WHERE hash = ? AND user_id = ?',
		request.params.hash, user.id);

	if (!user.admin && !formOwner) {
		return response.status(403)
			.send({error: 'only admins can view others forms feedbacks'});
	}

	const feedbacks = await db.all(`
		SELECT feedbacks.*, users.username FROM feedbacks
		LEFT JOIN users ON feedbacks.user_id = users.id
		WHERE form_hash = ? AND feedbacks.id < COALESCE(?, 9e999)
		ORDER BY feedbacks.id DESC LIMIT ?`,
		request.params.hash, lastID, 50);

	response.send(feedbacks.map(fb => ({
		id: fb.id,
		form: fb.form_hash,
		created: fb.created,
		username: fb.username,
		data: JSON.parse(fb.data),
	})));
}

async function submitFeedback(request, response) {
	const user = await users.checkCookie(request, response, true);
	let data = request.body.data;
	data = typeof data === 'object' && JSON.stringify(data) || data;

	//TODO: ensure feedback-data-schema matches form!

	let sqlResp;
	try {
		sqlResp = await db.run(`
			INSERT INTO feedbacks (user_id, form_hash, data)
			VALUES (?,?,?)`,
			user && user.id || null, request.params.hash, data);
	} catch(e) {
		//TODO:
		console.warn('SUBMIT FEEDBACK ERROR:', e);
	}

	const feedback = await db.get(`
		SELECT feedbacks.*, users.username FROM feedbacks
		LEFT JOIN users ON feedbacks.user_id = users.id
		WHERE feedbacks.id = ?`,
		sqlResp.stmt.lastID);

	response.send({
		id: feedback.id,
		form: feedback.form_hash,
		created: feedback.created,
		username: feedback.username,
		data: JSON.parse(feedback.data),
	});
}
