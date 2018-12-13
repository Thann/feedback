// REST API for users.
'use strict';

const db = require('../lib/db');
const users = require('./users');
const crypto = require('crypto');
const errors = require('../lib/errors');
const MemCache = require('../lib/memcache');

module.exports = function(app) {
	app.   get('/forms', index); // public
	app.  post('/forms', create);
	app.   get('/forms/:hash', read);
	app. patch('/forms/:hash', update);
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

	console.log("LAST ID", lastID)
	const forms = await db.all(`
		SELECT * FROM forms
		WHERE public = 1
			AND id < COALESCE(?, 9e999)
			AND expiration > CURRENT_TIMESTAMP
		ORDER BY id DESC LIMIT ?`,
		lastID, 50);

	response.send(forms.map(form => ({
		hash: form.hash,
		expiration: form.expiration,
		public: form.public,
		data: JSON.parse(form.data),
	})));
}

async function create(request, response) {
	const user = await users.checkCookie(request, response);

	// TODO: fancier encoding?
	const hash = (crypto.createHash('sha256')
		.update(Math.random().toString()).digest('hex').substring(1, 15));

	await db.run(`
		INSERT INTO forms (hash, expiration, public, data)
		VALUES (?,?,?,?)`,
		hash, request.body.expiration, request.body.public, request.body.data);

	response.send({
		hash,
		expiration: request.body.expiration,
		public: request.body.public,
		data: JSON.parse(request.body.data),
	});
}

async function read(request, response) {
	const form = await db.get(`
		SELECT * FROM forms
		WHERE hash = ?`,
		request.params.hash);

	if (!form) {
		return response.status(404).end();
	}
	response.send({
		hash: form.hash,
		expiration: form.expiration,
		public: form.public,
		data: JSON.parse(form.data),
	});
}

async function update(request, response) {
	const user = await users.checkCookie(request, response);

	// console.log("Update_CAMP", user, request.params.hash)

	const values = {};
	for (const k of ['expiration', 'public', 'data']) {
		if (request.body[k] !== undefined)
			values[k] = request.body[k];
	}

	let form;
	try {
		if (user.admin)
			form = await db.update('forms', values, 'hash = ?',
				request.params.hash);
		else
			form = await db.update('forms', values,
				'hash = ? AND user_id = ?',
				request.params.hash, user.id);
	} catch(e) {
		console.warn('FORM UPDATE ERROR:', e);
		return response.status(400).send({error: 'DB update error'});
	}

	if (!form.id) {
		return response.status(404).end();
	}

	//TODO: ?
	// const form = await db.get(`
	// 	SELECT * FROM forms
	// 	WHERE hash = ?`,
	// 	request.params.hash);

	response.send({
		hash: form.hash,
		expiration: form.expiration,
		public: form.public,
		data: JSON.parse(form.data),
	});
}

async function feedbacks(request, response) {
	const user = await users.checkCookie(request, response);
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

	const forms = await db.all(`
		SELECT * FROM feedbacks
		WHERE form_hash = ? AND id < COALESCE(?, 9e999)
		ORDER BY id DESC LIMIT ?`,
		request.params.hash, lastID, 50);

	response.send(forms);
}

// TODO: allow anoymous feedback!
async function submitFeedback(request, response) {
	let user;
	try {
		user = await users.checkCookie(request, response);
	} catch(e) { }

	let sqlResp;
	try {
		sqlResp = await db.run(`
			INSERT INTO forms (submitter_id, form_hash, data)
			VALUES (?,?,?)`,
			user && user.id, request.params.hash, request.body.data);
	} catch(e) {
		//TODO:
	}

	const form = await db.get(
		'SELECT * FROM feedbacks WHERE id = ?',
		sqlResp.stmt.lastID);

	response.send({
		id: form.id,
		user_id: form.user_id,
		form_hash: form.form_hash,
		time: form.expiration,
		data: JSON.parse(form.data),
	});
}
