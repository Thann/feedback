'use strict';

const db = require('../lib/db');
const server = require('../server');
const agent = require('supertest').agent(server, {prefix: '/api/v1'});

describe('Forms API', function() {
	beforeEach(async function() {
		await db.reset();
		await agent.post('/auth')
			.send({username: 'admin', password: 'admin'})
			.expect(200);
		// create basic form
		this.form = (
			await agent.post('/forms')
				.send({
					public: true,
					expiration: '2018-12-28',
					data: '{"name":"dude"}',
				}).expect(200)
		).body;
	});

	it('create', async function() {
		// TODO:
		// await agent.post('/forms')
		// 	.send({
		// 		public: True,
		// 		expiration: 'INVALID',
		// 		data: '{"name":"dope"}',
		// 	})
		// 	.expect(400, {expiration: 'invalid date format'});
		await agent.post('/forms')
			.send({
				public: true,
				expiration: '2018-12-28',
				data: '{"name":"sweet"}',
			})
			.expect(200, {
				hash: /\w{14}/,
				public: true,
				expiration: '2018-12-28',
				data: '{"name":"sweet"}',
			});
	});

	it('read', async function() {
		console.log("FFF", this.form)
		await agent.get('/forms/' + this.form.hash)
			.expect(200, this.form);
		await agent.get('/forms/666')
			.expect(404);
	});

	it('index', async function() {
		await agent.get('/forms')
			.expect(200, [this.form]);
	});

	it('update', async function() {
		await agent.patch('/doors/1')
			.expect(400, {name: 'required'});
		await agent.patch('/doors/1')
			.send({name: 'front'})
			.expect(200, {
				id: 1,
				name: 'front',
				token: /\w+/,
			});
	});

	it('delete', async function() {
		await agent.post('/doors')
			.send({name: 'delete_me'})
			.expect(200, {
				id: 2,
				name: 'delete_me',
				token: /\w+/,
			});
		await agent.delete('/doors/2')
			.expect(204, '');
		await agent.delete('/users/missing')
			.expect(404);
	});

	it('permit', async function() {
		await agent.post('/doors/1/permit/missing')
			.expect(404, { error: "user doesn't exist" });
		await agent.post('/doors/5/permit/admin')
			.expect(404, { error: "door doesn't exist" });
		await agent.post('/doors/1/permit/admin')
			.expect(200, {
				door_id: 1,
				username: 'admin',
			});
		await agent.delete('/doors/1/permit/admin')
			.expect(204);
		await agent.post('/doors/1/permit/admin')
			.send({
				// creation: '', //TODO:
				// expiration: '', //TODO:
				constraints: 'ip:192.168.1.1/30' })
			.expect(200, {
				door_id: 1,
				username: 'admin',
				// expiration: '',
				constraints: 'ip:192.168.1.1/30',
			});
		await agent.post('/doors/1/permit/admin')
			.expect(200, {
				door_id: 1,
				username: 'admin',
			});
	});

	it('deny', async function() {
		await agent.delete('/doors/1/permit/missing')
			.expect(404, { error: "door doesn't permit user" });
		await agent.delete('/doors/5/permit/admin')
			.expect(404, { error: "door doesn't permit user" });
		await agent.post('/doors/1/permit/admin').expect(200);
		await agent.delete('/doors/1/permit/admin')
			.expect(204, '');
		await agent.delete('/doors/1/permit/admin')
			.expect(404, { error: "door doesn't permit user" });
	});

	it('open', async function() {
		await agent.post('/doors/1/open')
			.expect(204, '');
	});

	it('logs', async function() {
		await agent.post('/doors/1/open').expect(204);
		await agent.get('/doors/1/logs')
			.expect(200, [{
				id: 1,
				door_id: 1,
				user_id: 1,
				username: 'admin',
				method: 'web:::ffff:127.0.0.1',
				deleted_at: null,
				time: /[\d\-: ]+/,
			}]);
		await agent.post('/doors/1/open').expect(204);
		await agent.get('/doors/1/logs?last_id=2')
			.expect(200, [{
				id: 1,
				door_id: 1,
				user_id: 1,
				username: 'admin',
				method: 'web:::ffff:127.0.0.1',
				deleted_at: null,
				time: /[\d\-: ]+/,
			}]);
		await agent.get('/doors/1/logs?last_id=x')
			.expect(200, [{
				id: 2,
				door_id: 1,
				user_id: 1,
				username: 'admin',
				method: 'web:::ffff:127.0.0.1',
				deleted_at: null,
				time: /[\d\-: ]+/,
			}, {
				id: 1,
				door_id: 1,
				user_id: 1,
				username: 'admin',
				method: 'web:::ffff:127.0.0.1',
				deleted_at: null,
				time: /[\d\-: ]+/,
			}]);
		await agent.get('/doors/2/logs')
			.expect(200, []);
	});

	// ===================================
	describe('as an under-privileged user', function() {
		beforeEach('auth', async function() {
			await agent.post('/users')
				.send({
					// admin: 0,
					username: 'form_dummy',
					password: 'form_dummy'})
				.expect(200);
			await agent.post('/auth')
				.send({username: 'form_dummy', password: 'form_dummy'})
				.expect(200);
		});

		it('create', async function() {
			await agent.post('/forms')
				.send({data: '{"":""}'})
				.expect(200);
		});

		it('read', async function() {
			await agent.get('/forms/' + this.form.hash)
				.expect(200, this.form);
			await agent.get('/forms/666')
				.expect(404);
		});

		it('index', async function() {
			await agent.get('/doors')
				.expect(200, [{
					id: 1,
					name: 'main',
				}]);
		});

		it('update', async function() {
			await agent.patch('/doors/1')
				.expect(400, {name: 'required'});
			await agent.patch('/doors/1')
				.send({name: 'bad'})
				.expect(403);
			await agent.patch('/doors/2')
				.send({name: 'bad'})
				.expect(403);
		});

		it('delete', async function() {
			await agent.delete('/doors/1')
				.expect(403);
			await agent.delete('/users/missing')
				.expect(403);
		});

		it('feedbacks', async function() {
		});

		it('submit', async function() {
		});
		// it('permit', async function() {
		// 	await agent.post('/doors/1/permit/door_dummy')
		// 		.expect(403);
		// 	await agent.post('/doors/1/permit/admin')
		// 		.expect(403);
		// 	await agent.post('/doors/2/permit/door_dummy')
		// 		.expect(403);
		// });

		// it('deny', async function() {
		// 	await agent.delete('/doors/1/permit/door_dummy')
		// 		.expect(403);
		// 	await agent.delete('/doors/1/permit/admin')
		// 		.expect(403);
		// });

		// it('open', async function() {
		// 	await agent.post('/doors/1/open')
		// 		.expect(422);
		// 	await agent.patch('/users/door_dummy')
		// 		.send({password: 'door_dummy'})
		// 		.expect(200);
		// 	await agent.post('/auth')
		// 		.send({username: 'door_dummy', password: 'door_dummy'})
		// 		.expect(200);
		// 	await agent.post('/doors/1/open')
		// 		.expect(204, '');
		// 	await agent.post('/doors/2/open')
		// 		.expect(403);
		// });

		// it('logs', async function() {
		// 	await agent.get('/doors/1/logs')
		// 		.expect(403);
		// });
	});

	describe('as an un-authenticated user', function() {
		beforeEach('auth', async function() {
			await agent.delete('/auth')
				.expect(204);
		});

		it('create', async function() {
			await agent.post('/forms')
				.send({data: '{"name":"dope"}'})
				.expect(401);
		});

		it('read', async function() {
			await agent.get('/forms/'+this.form.hash)
				.expect(200, this.form);
			await agent.get('/doors/666')
				.expect(404);
		});

		it('index', async function() {
			await agent.get('/doors')
				.expect(200, [{
					id: 1,
					name: 'main',
				}]);
		});

		it('update', async function() {
			await agent.patch('/doors/1')
				.expect(400, {name: 'required'});
			await agent.patch('/doors/1')
				.send({name: 'bad'})
				.expect(403);
			await agent.patch('/doors/2')
				.send({name: 'bad'})
				.expect(403);
		});

		it('delete', async function() {
			await agent.delete('/doors/1')
				.expect(403);
			await agent.delete('/users/missing')
				.expect(403);
		});

		it('feedbacks', async function() {
		});

		it('submit', async function() {
		});
	});
});
