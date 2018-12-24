'use strict';

const db = require('../lib/db');
const server = require('../server');
const agent = require('supertest').agent(server, {prefix: '/api/v1'});

describe('Users API', function() {
	beforeEach(async function() {
		await db.reset();
		await agent.post('/auth')
			.send({username: 'admin', password: 'admin'}).expect(200);
		await agent.post('/users')
			.send({username: 'Dummy', password: 'dummy'}).expect(200);
	});

	it('auth', async function() {
		await agent.post('/auth')
			.send({username: 'admin', password: 'bad'})
			.expect(400, {error: 'incorrect username or password'});
		await agent.post('/auth')
			.send({username: 'missing', password: 'bad'})
			.expect(400, {error: 'incorrect username or password'});
		await agent.delete('/auth')
			.expect('set-cookie', /^Session=; Path=\/; Expires=/)
			.expect(204);
		await agent.delete('/auth')
			.expect('set-cookie', /^Session=; Path=\/; Expires=/)
			.expect(401, {error: 'session cookie malformed'});
		await agent.delete('/auth')
			.expect('set-cookie', /^Session=; Path=\/; Expires=/)
			//TODO: Why is cookie malformed the second time?
			.expect(401, {error: 'session cookie malformed'});
		await agent.post('/auth')
			.send({username: 'admin', password: 'admin'})
			.expect('set-cookie', /^Session=\w+; HttpOnly; Max-Age=\d+$/)
			.expect(200, {
				id: 1,
				username: 'admin',
				last_login: /\w+/,
				requires_reset: true,
			});
	});

	it('create', async function() {
		await agent.post('/users')
			.send({username: 'Dummy'})
			.expect(400, {username: 'already taken'});
		await agent.post('/users')
			.send({username: 'me'})
			.expect(400, {username: 'invalid'});
		await agent.post('/users')
			.send({username: 'Testing'})
			.expect(200, {
				id: 3,
				admin: false,
				password: /\w{14}/,
				username: 'Testing',
				requires_reset: true,
			});
		await agent.delete('/users/Testing').expect(204);
		await agent.post('/users')
			.send({username: 'Testing', password: 'dumb'})
			.expect(200, {
				id: 4,
				admin: false,
				password: 'dumb',
				username: 'Testing',
				requires_reset: true,
			});
	});

	it('read', async function() {
		await agent.get('/users/admin')
			.expect(200, {
				id: 1,
				admin: true,
				password: 'admin',
				username: 'admin',
				requires_reset: true,
			});
		await agent.get('/users/Dummy')
			.expect(200, {
				id: 2,
				admin: false,
				password: /\w+/,
				username: 'Dummy',
				requires_reset: true,
			});
		await agent.get('/users/missing')
			.expect(404);
	});

	it('index', async function() {
		await agent.get('/users')
			.expect(200, [{
				id: 1,
				admin: true,
				password: 'admin',
				username: 'admin',
				requires_reset: true,
			}, {
				id: 2,
				admin: false,
				password: /\w+/,
				username: 'Dummy',
				requires_reset: true,
			}]);
	});

	it('update', async function() {
		await agent.patch('/users/Dummy')
			.send({password: 'dummy'})
			.expect(200, {
				id: 2,
				admin: false,
				username: 'Dummy',
				password: 'dummy',
				requires_reset: true,
			});
		await agent.patch('/users/admin')
			.send({password: 'admin', keycode: 1})
			.expect(200, {
				id: 1,
				admin: true,
				username: 'admin',
				requires_reset: false,
			});
		await agent.get('/users/admin')
			.expect(200, {
				id: 1,
				admin: true,
				username: 'admin',
				requires_reset: false,
			});
		await agent.patch('/users/admin')
			.send({password: 'admin'})
			.expect(400, {current_password: 'incorrect password'});
		await agent.patch('/users/admin')
			.send({password: 'admin', current_password: 'admin'})
			.expect(200);
	});

	it('delete', async function() {
		await agent.post('/users')
			.send({username: 'delete_me', password: 'delete_me'})
			.expect(200);
		await agent.post('/auth')
			.send({username: 'delete_me', password: 'delete_me'}).expect(200);
		await agent.patch('/users/delete_me')
			.send({password: 'dummydummy'}).expect(200);
		await agent.post('/auth')
			.send({username: 'admin', password: 'admin'}).expect(200);
		await agent.delete('/users/delete_me')
			.expect(204, '');
		await agent.delete('/users/missing')
			.expect(404);
		await agent.post('/users')
			.send({username: 'delete_me'})
			.expect(200);
		await agent.get('/users/delete_me')
			.expect(200, {
				id: 4,
				admin: false,
				username: 'delete_me',
				password: /\w{14}/,
				requires_reset: true,
			});
		await agent.delete('/users/Dummy')
			.expect(204);
		// await agent.get('/users/me')
		// 		.expect(401);
	});

	it('logout', async function() {
		await agent.delete('/auth')
			.expect('set-cookie', /^Session=; Path=\/; Expires=/)
			.expect(204, '');
		await agent.get('/users/admin')
			.expect(401);
		await agent.delete('/auth')
			.expect(401);
	});

	it('forms', async function() {
		const form = (
			await agent.post('/forms')
				.send({
					public: true,
					data: '{"name":"dude"}',
				}).expect(200)
		).body;
		await agent.get('/users/admin/forms')
			.expect(200, [form]);
	});

	it('feedbacks', async function() {
		await agent.get('/users/admin/feedbacks')
			.expect(200, []);
		const form = (
			await agent.post('/forms')
				.send({
					public: true,
					data: '{"name":"dude"}',
				}).expect(200)
		).body;
		await agent.get('/users/admin/feedbacks')
			.expect(200, []);
		const fb = (
			await agent.post('/forms/' + form.hash + '/feedbacks')
				.send({
					data: {something: 'arbitrary'},
				})
				.expect(200, {
					id: 1,
					username: 'admin',
					created: /[\d\-: ]+/,
					form: form.hash,
					data: {something: 'arbitrary'},
					form_creator: 'admin',
					form_data: form.data,
				})
		).body;
		await agent.get('/users/admin/feedbacks')
			.expect(200, [fb]);
	});

	describe('as an under-privileged user', function() {
		beforeEach(async function() {
			await agent.post('/auth')
				.send({username: 'admin', password: 'admin'})
				.expect(200);
			await agent.post('/auth')
				.send({
					username: 'Dummy',
					password: 'dummy',
					admin: 1})
				.expect(200);
		});

		it('auth', async function() {
			await agent.post('/auth')
				.send({username: 'Dummy', password: 'dummy'})
				.expect('set-cookie', /^Session=\w+; HttpOnly; Max-Age=\d+$/)
				.expect(200);
		});

		it('create', async function() {
			await agent.post('/users')
				.send({username: 'noob'})
				.expect(403, {error: 'must have invite'});
			await agent.post('/users')
				.send({username: 'noob', invite: 'invalid'})
				.expect(400, {error: 'invalid or expired invite'});
			//TODO: with valid token
		});

		it('read', async function() {
			await agent.get('/users/dummy')
				.expect(200, {
					id: 2,
					admin: false,
					username: 'Dummy',
					requires_reset: true,
				});
			await agent.get('/users/admin')
				.expect(403);
			await agent.get('/users/missing')
				.expect(403);
		});

		it('index', async function() {
			await agent.get('/users')
				.expect(403);
		});

		it('update', async function() {
			await agent.patch('/users/missing')
				.send({password: 'door_dummy'})
				.expect(403, {error: 'can only update your own info'});
			await agent.patch('/users/Dummy')
				.send({password: 'dummy'})
				.expect(400, {password: 'must be at least 8 characters'});
			await agent.patch('/users/dummy')
				.send({password: 'door_dummy'})
				.expect(200, {
					id: 2,
					admin: false,
					username: 'Dummy',
					requires_reset: false,
				});
			await agent.get('/users/Dummy')
				.expect(200, {
					id: 2,
					admin: false,
					username: 'Dummy',
					requires_reset: false,
				});
			await agent.patch('/users/Dummy')
				.send({password: 'door_dummy2'})
				.expect(400, {current_password: 'incorrect password'});
			await agent.patch('/users/Dummy')
				.send({current_password: 'door_dummy', password: 'door_dummy2'})
				.expect(200);
			// admin permissions
			await agent.patch('/users/Dummy')
				.send({admin: 1})
				.expect(403, {error: "can't make yourself admin"});
			await agent.post('/auth')
				.send({username: 'admin', password: 'admin'}).expect(200);
		});

		it('delete', async function() {
			await agent.delete('/users/admin')
				.expect(403);
			await agent.delete('/users/missing')
				.expect(403);
			await agent.delete('/users/Dummy')
				.expect(204);
			await agent.get('/users/me')
				.expect(401);
		});

		it('logout', async function() {
			await agent.delete('/auth')
				.expect('set-cookie', /^Session=; Path=\/; Expires=/)
				.expect(204, '');
			await agent.get('/users/Dummy')
				.expect(401);
			await agent.delete('/auth')
				.expect(401);
		});

		it('forms', async function() {
			const form = (
				await agent.post('/forms')
					.send({
						public: true,
						data: '{"name":"dude"}',
					}).expect(200)
			).body;
			await agent.get('/users/admin/forms')
				.expect(403, { error: 'only admins can view others' });
			await agent.get('/users/dummy/forms')
				.expect(200, [form]);
		});

		it('feedbacks', async function() {
			await agent.get('/users/admin/feedbacks')
				.expect(403, { error: 'only admins can view others' });
			await agent.get('/users/dummy/feedbacks')
				.expect(200, []);
			const form = (
				await agent.post('/forms')
					.send({
						public: true,
						data: '{"name":"dude"}',
					}).expect(200)
			).body;
			await agent.get('/users/dummy/feedbacks')
				.expect(200, []);
			const fb = (
				await agent.post('/forms/' + form.hash + '/feedbacks')
					.send({
						data: {something: 'arbitrary'},
					})
					.expect(200, {
						id: 1,
						username: 'Dummy',
						created: /[\d\-: ]+/,
						form: form.hash,
						data: {something: 'arbitrary'},
						form_creator: 'Dummy',
						form_data: form.data,
					})
			).body;
			await agent.get('/users/Dummy/feedbacks')
				.expect(200, [fb]);
		});
	});
});
