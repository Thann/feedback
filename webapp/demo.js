// Poison Backbone models & collections to sync mock data
module.exports = require('./main');

const mockForm = {
	hash: 'abc123',
	feedbacks: 3,
	owner: 'DemoUser',
	expiration: null,
	public: true,
	data: {
		name: 'Freedom Survey',
		description: 'What does freedom mean to you?',
		entries: [
			{
				title: 'Which of these are the most important freedoms?',
				other: 'Other',
				options: [
					'Free speech',
					'Free press',
					'Freedom of information',
					'Freedom of movement',
					'Freedom of assembly',
					'Software Freedom',
					'Free Market',
				],
			},
			{
				title: 'Which of these are the least important freedoms?',
				other: 'Other',
				options: [
					'Free speech',
					'Free press',
					'Freedom of information',
					'Freedom of movement',
					'Freedom of assembly',
					'Software Freedom',
					'Free Market',
				],
			},
			{
				title: 'How much do you value Software Freedom?',
				description: 'On a scale from "Steve Jobs" to "Richard Stallman":',
				type: '1',
				options: [
					'Steve Jobs',
					'',
					'',
					'',
					'Richard Stallman',
				],
			},
			{
				title: 'Additionl comments',
				other: ' ',
			},
		],
	},
};

const mockForm2 = {
	hash: '456def',
	public: false,
	feedbacks: 1,
	owner: 'admin',
	data: JSON.parse(module.exports.Views.CreatePanel.prototype.sampleFormData),
};

const mockSecretForm = {
	hash: 'super-secret',
	public: false,
	feedbacks: 1,
	owner: 'DemoUser',
	data: {
		name: 'secret form',
		entries: [
			{
				title: 'How did you find this form?',
			},
		],
	},
};

const mockFeedback = {
	id: 69,
	form: 'abc123',
	created: '2018-12-24 06:43:42',
	username: 'DemoUser',
	data: {
		responses: {
			0: [
				'other response!',
			],
		},
	},
	form_creator: 'DemoUser',
	form_data: mockForm.data,
};

const MockData = {
	'site/settings': {
		orgName: 'DemoOrg',
	},
	'site/private_settings': {},
	'users/me': {
		id: 'me',
		admin: 1,
		username: 'DemoUser',
	},
	'users': [
		{
			username: 'admin',
		}, {
			id: 2,
			username: 'noob',
			password: 'b872fe2ac43442',
			requires_reset: true,
		},
	],
	'users/DemoUser/forms': [
		mockForm,
		mockSecretForm,
	],
	'forms': [
		mockForm,
		mockForm2,
	],
	'forms/abc123': mockForm,
	'forms/456def': mockForm2,
	'forms/super-secret': mockSecretForm,
	'forms/abc123/feedbacks?last_id=': [
		mockFeedback,
	],
	'users/DemoUser/feedbacks?last_id=': [
		mockFeedback,
	],
};

const sync = Backbone.sync;
Backbone.sync = function(method, model, options) {
	const url = options.url || (_.isFunction(this.url)? this.url() : this.url);
	for (const [key, value] of Object.entries(MockData)) {
		if (url.endsWith(key)) {
			console.log('DEMO: Mocking data for', url, value);
			this.set(value);
			this.trigger('sync');
			if (options.success)
				setTimeout(() => {
					options.success(value);
				});
			return this;
		}
	}
	console.warn('DEMO: Failed to find mock data for', url);
	sync.apply(this, arguments);
};
