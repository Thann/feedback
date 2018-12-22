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
					data: '{"name":"dude"}',
				}).expect(200)
		).body;
		// create private form
		this.private = (
			await agent.post('/forms')
				.send({
					public: false,
					data: '{"name":"secret"}',
				}).expect(200)
		).body;
		// create dummy user + form
		await agent.post('/users')
			.send({
				username: 'form_dummy',
				password: 'form_dummy'})
			.expect(200);
		await agent.post('/auth')
			.send({username: 'form_dummy', password: 'form_dummy'})
			.expect(200);
		this.dform = (
			await agent.post('/forms')
				.send({
					public: true,
					data: '{"":""}',
				})
				.expect(200)
		).body;
		// auth as admin
		await agent.post('/auth')
			.send({username: 'admin', password: 'admin'})
			.expect(200);
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
				expiration: null,
				data: {name: 'sweet'},
			})
			.expect(200, {
				hash: /\w{14}/,
				public: true,
				owner: 'admin',
				expiration: null,
				data: {name: 'sweet'},
			});
	});

	it('read', async function() {
		await agent.get('/forms/' + this.form.hash)
			.expect(200, this.form);
		await agent.get('/forms/missing')
			.expect(404);
		await agent.get('/forms/' + this.private.hash)
			.expect(200, this.private);
		await agent.get('/forms/' + this.dform.hash)
			.expect(200, this.dform);
	});

	it('index', async function() {
		await agent.get('/forms')
			.expect(200, [this.dform, this.form]);
		await agent.delete('/forms/' + this.form.hash)
			.expect(204);
		await agent.get('/forms')
			.expect(200, [this.dform]);
	});

	it('update', async function() {
		await agent.patch('/forms/' + this.form.hash)
			.expect(400, {error: 'nothing to update'});
		await agent.patch('/forms/missing')
			.send({public: false})
			.expect(404);
		await agent.patch('/forms/' + this.form.hash)
			.send({
				public: false,
				data: {name: 'brah'},
			})
			.expect(200, {
				hash: /\w{14}/,
				public: false,
				owner: 'admin',
				expiration: null,
				data: {name: 'brah'},
			});
		// admins can update others
		await agent.patch('/forms/' + this.dform.hash)
			.send({
				public: false,
				data: {name: 'dummys'},
			})
			.expect(200, {
				hash: /\w{14}/,
				public: false,
				owner: 'form_dummy',
				expiration: null,
				data: {name: 'dummys'},
			});
	});

	it('delete', async function() {
		await agent.delete('/forms/' + this.form.hash)
			.expect(204, '');
		// Not actually deleted, just expired
		await agent.get('/forms/' + this.form.hash)
			.expect(200, {
				hash: /\w{14}/,
				public: true,
				owner: 'admin',
				expiration: /[\d\-: ]+/,
				data: {name: 'dude'},
			});
		await agent.get('/forms')
			.expect(200, [this.dform]);
		await agent.delete('/forms/' + this.form.hash)
			.expect(404, '');
		await agent.delete('/forms/missing')
			.expect(404);
		await agent.delete('/forms/' + this.dform.hash)
			.expect(204, '');
		// Not actually deleted, just expired
		await agent.get('/forms/' + this.dform.hash)
			.expect(200, {
				hash: /\w{14}/,
				public: true,
				owner: 'form_dummy',
				expiration: /[\d\-: ]+/,
				data: {'': ''},
			});
		await agent.get('/forms')
			.expect(200, []);
	});

	it('feedbacks', async function() {
		// create feedbacks
		await agent.post('/forms/' + this.form.hash + '/feedbacks')
			.send({
				data: {something: 'arbitrary'},
			})
			.expect(200, {
				id: 1,
				username: 'admin',
				created: /[\d\-: ]+/,
				form: this.form.hash,
				data: {something: 'arbitrary'},
			});
		await agent.post('/forms/' + this.form.hash + '/feedbacks')
			.send({
				data: {something: 'different'},
			})
			.expect(200, {
				id: 2,
				username: 'admin',
				created: /[\d\-: ]+/,
				form: this.form.hash,
				data: {something: 'different'},
			});
		await agent.post('/forms/' + this.dform.hash + '/feedbacks')
			.send({
				data: {something: 'else'},
			})
			.expect(200, {
				id: 3,
				username: 'admin',
				created: /[\d\-: ]+/,
				form: this.dform.hash,
				data: {something: 'else'},
			});
		// list feedbacks
		await agent.get('/forms/' + this.form.hash + '/feedbacks')
			.expect(200, [{
				id: 2,
				username: 'admin',
				created: /[\d\-: ]+/,
				form: this.form.hash,
				data: {something: 'different'},
			}]);
		await agent.get('/forms/' + this.dform.hash + '/feedbacks')
			.expect(200, [{
				id: 3,
				username: 'admin',
				created: /[\d\-: ]+/,
				form: this.dform.hash,
				data: {something: 'else'},
			}]);
	});

	// ===================================
	describe('as an under-privileged user', function() {
		beforeEach('auth', async function() {
			await agent.post('/forms/' + this.dform.hash + '/feedbacks')
				.send({
					data: {something: 'arbitrary'},
				})
				.expect(200, {
					id: 1,
					username: 'admin',
					created: /[\d\-: ]+/,
					form: this.dform.hash,
					data: {something: 'arbitrary'},
				});
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
			await agent.get('/forms/missing')
				.expect(404);
			await agent.get('/forms/' + this.private.hash)
				.expect(200, this.private);
		});

		it('index', async function() {
			await agent.get('/forms')
				.expect(200, [this.dform, this.form]);
		});

		it('update', async function() {
			await agent.patch('/forms/missing')
				.send({public: false})
				.expect(404);
			await agent.patch('/forms/' + this.form.hash)
				.send({public: false})
				.expect(404);
			await agent.patch('/forms/' + this.dform.hash)
				.expect(400, {error: 'nothing to update'});
			await agent.patch('/forms/' + this.dform.hash)
				.send({
					public: false,
					data: {'name': 'brah'},
				})
				.expect(200, {
					hash: /\w{14}/,
					public: false,
					owner: 'form_dummy',
					expiration: null,
					data: {name: 'brah'},
				});
		});

		it('delete', async function() {
			await agent.delete('/forms/' + this.dform.hash)
				.expect(204, '');
			// Not actually deleted, just expired
			await agent.get('/forms/' + this.dform.hash)
				.expect(200, {
					hash: /\w{14}/,
					public: true,
					owner: 'form_dummy',
					expiration: /[\d\-: ]+/,
					data: {'': ''},
				});
			await agent.get('/forms')
				.expect(200, [this.form]);
			await agent.delete('/forms/' + this.form.hash)
				.expect(404, '');
			await agent.delete('/forms/missing')
				.expect(404);
		});

		it('feedbacks', async function() {
			// create feedbacks
			await agent.post('/forms/' + this.form.hash + '/feedbacks')
				.send({
					data: {something: 'arbitrary'},
				})
				.expect(200, {
					id: 2,
					username: 'form_dummy',
					created: /[\d\-: ]+/,
					form: this.form.hash,
					data: {something: 'arbitrary'},
				});
			await agent.post('/forms/' + this.form.hash + '/feedbacks')
				.send({
					data: {something: 'different'},
				})
				.expect(200, {
					id: 3,
					username: 'form_dummy',
					created: /[\d\-: ]+/,
					form: this.form.hash,
					data: {something: 'different'},
				});
			await agent.post('/forms/' + this.dform.hash + '/feedbacks')
				.send({
					data: {something: 'else'},
				})
				.expect(200, {
					id: 4,
					username: 'form_dummy',
					created: /[\d\-: ]+/,
					form: this.dform.hash,
					data: {something: 'else'},
				});
			// list feedbacks
			await agent.get('/forms/' + this.form.hash + '/feedbacks')
				.expect(403);
			await agent.get('/forms/' + this.dform.hash + '/feedbacks')
				.expect(200, [
					{
						id: 4,
						username: 'form_dummy',
						created: /[\d\-: ]+/,
						form: this.dform.hash,
						data: {something: 'else'},
					}, {
						id: 1,
						username: 'admin',
						created: /[\d\-: ]+/,
						form: this.dform.hash,
						data: {something: 'arbitrary'},
					},
				]);
		});
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
			await agent.get('/forms/missing')
				.expect(404);
			await agent.get('/forms/' + this.private.hash)
				.expect(200, this.private);
		});

		it('index', async function() {
			await agent.get('/forms')
				.expect(200, [this.dform, this.form]);
		});

		it('update', async function() {
			await agent.patch('/forms/missing')
				.expect(401);
			await agent.patch('/forms/missing')
				.send({public: false})
				.expect(401);
			await agent.patch('/forms/' + this.form.hash)
				.send({public: false})
				.expect(401);
		});

		it('delete', async function() {
			await agent.delete('/forms/' + this.dform.hash)
				.expect(401);
			await agent.get('/forms/' + this.dform.hash)
				.expect(200, {
					hash: /\w{14}/,
					public: true,
					owner: 'form_dummy',
					expiration: null,
					data: {'': ''},
				});
			await agent.get('/forms')
				.expect(200, [this.dform, this.form]);
			await agent.delete('/forms/' + this.form.hash)
				.expect(401);
			await agent.delete('/forms/missing')
				.expect(401);
		});

		it('feedbacks', async function() {
			// create feedbacks
			await agent.post('/forms/' + this.form.hash + '/feedbacks')
				.send({
					data: {something: 'arbitrary'},
				})
				.expect(200, {
					id: 1,
					username: null,
					created: /[\d\-: ]+/,
					form: this.form.hash,
					data: {something: 'arbitrary'},
				});
			await agent.post('/forms/' + this.form.hash + '/feedbacks')
				.send({
					data: {something: 'different'},
				})
				.expect(200, {
					id: 2,
					username: null,
					created: /[\d\-: ]+/,
					form: this.form.hash,
					data: {something: 'different'},
				});
			await agent.post('/forms/' + this.dform.hash + '/feedbacks')
				.send({
					data: {something: 'else'},
				})
				.expect(200, {
					id: 3,
					username: null,
					created: /[\d\-: ]+/,
					form: this.dform.hash,
					data: {something: 'else'},
				});
			// list feedbacks
			await agent.get('/forms/' + this.form.hash + '/feedbacks')
				.expect(401);
			await agent.get('/forms/' + this.dform.hash + '/feedbacks')
				.expect(401);
			// admin can list feedbacks
			await agent.post('/auth')
				.send({username: 'admin', password: 'admin'})
				.expect(200);
			await agent.get('/forms/' + this.form.hash + '/feedbacks')
				.expect(200, [
					{
						id: 2,
						username: null,
						created: /[\d\-: ]+/,
						form: this.form.hash,
						data: {something: 'different'},
					}, {
						id: 1,
						username: null,
						created: /[\d\-: ]+/,
						form: this.form.hash,
						data: {something: 'arbitrary'},
					},
				]);
		});
	});
});
