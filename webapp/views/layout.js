// Layout - The parent view of the whole app, and also the router.

require('styles/layout.css');

const UserModel = require('models/user.js');

module.exports = Backbone.View.extend({
	el: 'body',
	template: `
		<div data-subview="header"></div>
		<div class="main-bar">
			<div data-subview="sidebar"></div>
			<div class="main-panel">...</div>
		</div>
		<div class="footer hidden"></div>
	`,
	loading: true,
	events: {
		'click #Header .toggle-left-sidebar': function() {
			this.subviews.sidebar.toggle();
		},
	},
	subviewCreators: {
		form: function() { return new Feedback.Views.FormPanel(); },
		user: function() { return new Feedback.Views.UserPanel(); },
		admin: function() { return new Feedback.Views.AdminPanel(); },
		login: function() { return new Feedback.Views.LoginPanel(); },
		create: function() { return new Feedback.Views.CreatePanel(); },
		feedbacks: function() { return new Feedback.Views.FeedbacksPanel(); },
		header: function() { return new Feedback.Views.Header(); },
		sidebar: function() { return new Feedback.Views.Sidebar(); },
	},
	initialize: function() {
		const layout = this;
		this.loading = true;
		Backbone.Subviews.add( this );

		Feedback.Router = new (Backbone.Router.extend({
			routes: {
				'': 'login',
				'login': 'login',
				'admin': 'admin',
				//TODO: replace "create" with "form" edit mode
				'create': 'create',
				'user/:id': 'user',
				':form/feedback': 'feedbacks',
				':form/feedback/:fbid': 'feedbacks',
				'*notFound': 'form',
			},
			unauthRoutes: ['form', 'login'],
			execute: function(cb, args, name) {
				this.args = args;
				if (!layout.loading && !Feedback.User.isAuthed
						&& !this.lastRouteUnauthed()) {
					this.navigate('login', {trigger: true});
				} else if (!Feedback.Router.name
						&& layout.subviewCreators[name]) {
					this.lastRoute = name;
					layout.render(name);
				} else {
					// route not found
					this.navigate('', {trigger: true});
				}
			},
			lastRouteUnauthed: function() {
				return this.unauthRoutes.indexOf(this.lastRoute) >= 0;
			},
		}))();

		Feedback.User = new UserModel();
		this.listenTo(Feedback.User, 'relog', function(loggedIn) {
			if (loggedIn || Feedback.Router.lastRouteUnauthed()) {
				layout.render();
			} else {
				Feedback.Router.navigate('login', {trigger: false});
				layout.render('login');
			}
		});

		Feedback.Settings = new (Backbone.Model.extend({
			url: '/api/v1/site/settings',
		}))();
		Feedback.Settings.fetch();
		// Fetch on user sync?

		this.setTitle();
		Backbone.history.start();
		Feedback.User.init();
	},
	setTitle: function() {
		document.title = 'Feedback '+(
			Feedback.AppConfig.OrgName? ' - '+Feedback.AppConfig.OrgName : '');
	},
	render: function(tmpl) {
		this.$el.html(this.template);
		if (tmpl)
			this._current_template = `<div data-subview="${tmpl}"></div>`;
		if (!this.loading) {
			this.$('.main-panel').html(this._current_template);
		}
		this.loading = false;
		return this;
	},
});
