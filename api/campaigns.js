// REST API for users.
'use strict';

const db = require('../lib/db');
const users = require('./users');
const crypto = require('crypto');
const errors = require('../lib/errors');
const MemCache = require('../lib/memcache');

module.exports = function(app) {
	app.   get('/campaigns', index); // public
	app.  post('/campaigns', create);
	app.   get('/campaigns/:hash', read);
	app. patch('/campaigns/:hash', update);
	app.   get('/campaigns/:hash/feedbacks', feedbacks);
	app.  post('/campaigns/:hash/feedbacks', createFeedback);
};

// === API ===

async function index(request, response) {
	let lastID;
	try {
		lastID = parseInt(request.query.last_id);
	} catch(e) {
		return response.status(400).send({last_id: 'must be an int'});
	}

	const camps = await db.all(`
		SELECT * FROM campaigns
		WHERE visibility = TRUE
			AND id < COALESCE(?, 9e999)
			AND expiration < CURRENT_TIMESTAMP
		ORDER BY id DESC LIMIT ?`,
		lastID, 50);

	response.send(camps);
}

async function create(request, response) {
	const user = await users.checkCookie(request, response);

	// TODO: fancier encoding?
	const hash = (crypto.createHash('sha256')
		.update(Math.random().toString()).digest('hex').substring(1, 15));

	await db.run(`
		INSERT INTO campaigns (hash, expiration, visibility, data)
		VALUES (?,?,?,?)`,
		hash, request.body.expiration, request.body.visibility, request.body.data);

	response.send({
		hash,
		expiration: request.body.expiration,
		visibility: request.body.visibility,
		data: request.body.data,
	});
}

async function read(request, response) {
	const camp = await db.get(`
		SELECT * FROM campaigns
		WHERE hash = ?`,
		request.params.hash);

	if (!camp.id) {
		return response.status(404).end();
	}
	response.send({
		hash: camp.hash,
		expiration: camp.expiration,
		visibility: camp.visibility,
		data: JSON.parse(camp.data),
	});
}

async function update(request, response) {
	const user = await users.checkCookie(request, response);

	// console.log("Update_CAMP", user, request.params.hash)

	const values = {};
	for (const k of ['expiration', 'visibility', 'data']) {
		if (request.body[k] !== undefined)
			values[k] = request.body[k];
	}

	let camp;
	try {
		if (user.admin)
			camp = await db.update('campaigns', values, 'hash = ?',
				request.params.hash);
		else
			camp = await db.update('campaigns', values,
				'hash = ? AND user_id = ?',
				request.params.hash, user.id);
	} catch(e) {
		console.warn('CAMPAIGN UPDATE ERROR:', e);
		return response.status(400).send({error: 'DB update error'});
	}

	if (!camp.id) {
		return response.status(404).end();
	}

	//TODO: ?
	// const camp = await db.get(`
	// 	SELECT * FROM campaigns
	// 	WHERE hash = ?`,
	// 	request.params.hash);

	response.send({
		hash: camp.hash,
		expiration: camp.expiration,
		visibility: camp.visibility,
		data: JSON.parse(camp.data),
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

	const camps = await db.all(`
		SELECT * FROM feedbacks
		WHERE campaign_hash = ? AND id < COALESCE(?, 9e999)
		ORDER BY id DESC LIMIT ?`,
		request.params.hash lastID, 50);

	response.send(camps);
}

// TODO: allow anoymous feedback?
async function createFeedback(request, response) {
	const user = await users.checkCookie(request, response);

	const sqlResp = await db.run(`
		INSERT INTO campaigns (submitter_id, campaign_hash, data)
		VALUES (?,?,?)`,
		user && user.id, request.params.hash, request.body.data);

	const camp = await db.get(
		'SELECT * FROM feedbacks WHERE id = ?',
		sqlResp.stmt.lastID)

	response.send({
		id: camp.id
		user_id: camp.user_id
		campaign_hash: camp.campaign_hash,
		time: camp.expiration,
		data: JSON.parse(camp.data),
	});
}
