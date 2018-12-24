// UserPanel

// require('styles/user.css');
const UserModel = require('models/user.js');

module.exports = Backbone.View.extend({
	id: 'UserPanel',
	className: 'container',
	template: `
		<div class="user panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".user .panel-collapse">
				<div class="panel-title" rv-text="user:username"></div>
			</div>
			<div class="panel-collapse collapse in">
				<div class="panel-body">
					<form>
						<table>
							<tr rv-show="user:admin">
								<td>Admin</td>
							</tr>
							<tr>
								<td>Password</td>
								<td class="form-inline">
									<input rv-type="pwType" placeholder="hidden"
										name="password" class="form-control"
										rv-value="user:password" autocomplete="new-password">
									<input rv-if="showCurrent" type="password"
										name="current_password" class="form-control"
										placeholder="current password" autocomplete="current-password">
									<button rv-show="self:admin" rv-disabled="me"
										class="btn btn-default fa fa-random password"></button>
									<span rv-show="user:requires_reset" class="fa fa-warning text-danger">
										requires reset</span>
									<input placeholder="username" type="hidden" name="username"
										rv-value="user:username" autocomplete="username">
								</td>
							</tr>
						</table>
					</form>
				</div>
				<div class="panel-footer">
					<input type="submit" value="Update" class="update btn btn-default">
					<span rv-text="updateSuccess"></span>
					<span class="text-danger" rv-text="updateError"></span>
					<a rv-show="me" class="btn btn-default pull-right logout">logout</a>
					<span rv-show="self:admin">
						<a rv-hide="me" class="btn btn-danger delete pull-right">
						Delete</a>
					</span>
				</div>
			</div>
		</div>

		<div class="forms panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".forms .panel-collapse">
				<div class="panel-title">
					Forms
					<a href="#create" class="fa fa-plus"></a>
				</div>
			</div>
			<div class="panel-collapse collapse in">
				<div class="panel-body">
					<ol>
						<li rv-each-form="forms">
							<span rv-text="form:id"></span>
							<a rv-href="'#' |+ form:hash"
								rv-text="form:data.name |or form:hash"></a>
							<a rv-href="'#' |+ form:hash |+ '/feedback'">
								({ form:feedbacks })</a>
						</li>
					</ol>
				</div>
			</div>
		</div>

		<div class="feedbacks panel panel-default">
			<div class="panel-heading fetch" data-toggle="collapse" data-target=".feedbacks .panel-collapse">
				<div class="panel-title">Feedbacks</div>
			</div>
			<div class="panel-collapse" rv-class-in="feedbacks.length |gt 50">
				<div class="panel-body">
					<ol>
						<li rv-each-feedback="feedbacks">
							<a rv-href="'#' |+ feedback:form |+ '/feedback'"
								rv-text="feedback:form_data.name |or feedback:form">
							</a>
							<span rv-text="feedback:created |luxon 'DATETIME_SHORT'"></span>
						</li>
					</ol>
				</div>
				<div class="panel-footer">
					<input type="submit" value="More" class="more btn btn-default"
						rv-enabled="feedbacks.hasMore">
					<div class="error" rv-text="feedbacksError"></div>
				</div>
			</div>
		</div>
	`,
	events: {
		'click .update': 'update',
		'click .fa-random.password': 'scramblePassword',
		'click .logout': 'logout',
		'click .delete': 'delUser',
		'click .feedbacks .toggle': 'toggleFeedbacks',
		'click .feedbacks .more': 'moreFeedbacks',
	},
	initialize: function() {
		const username = Feedback.Router.args[0];
		if (username === Feedback.User.get('username')) {
			this.user = Feedback.User;
		} else {
			this.user = new UserModel({username: username});
			this.user.fetch({error: function() {
				Feedback.Router.navigate('', {trigger: true});
			}});
		}

		this.forms = new (Backbone.Collection.extend({
			url: `/api/v1/users/${username}/forms`,
		}))();
		this.forms.fetch({success: () => {
			this.render();
		}});

		this.feedbacks = new (Backbone.Collection.extend({
			hasMore: true,
			url: function() {
				const lastID = this.models.length &&
					this.models[this.models.length-1].id || '';
				return '/api/v1/users/'+username+'/feedbacks?last_id='+lastID;
			},
		}))();
		this.moreFeedbacks();

		//TODO: forms and feedbacks

		const me = this.user.id === Feedback.User.id;
		this.scope = {
			me,
			user: this.user,
			forms: this.forms,
			feedbacks: this.feedbacks,
			self: Feedback.User,
			pwType: me ? 'password': 'text',
			showCurrent: !this.user.get('requires_reset') && me,
		};
	},
	render: function() {
		if (Feedback.Router.args[0] !== this.user.get('username'))
			return this.initialize();
		this.$el.html(this.template);
		//TODO: rivets throws an error because of user?
		Rivets.bind(this.$el, this.scope);
		return this;
	},
	toggleFeedbacks: function() {
		this.Feedbacks.open = !this.Feedbacks.open;
	},
	moreFeedbacks: function() {
		this.feedbacks.fetch({ add: true, remove: false,
			success: (coll, newLogs) => {
				if (newLogs.length < 50)
					coll.hasMore = false;
				//TODO: should not be needed
				this.render();
			},
		});
	},
	logout: function() {
		Feedback.User.logout();
	},
	update: function(e) {
		e.preventDefault();
		const data = this.$('form').serializeObject();
		if (data.password === '')
			data.password = undefined;
		if (data.keycode === '')
			data.keycode = undefined;
		else
			this.user.keycode = data.keycode.toString().padStart(8, '0');
		this.scope.updateError = null;
		this.scope.updateSuccess = null;

		this.user.save(data, {patch: true, wait: true,
			success: () => {
				this.scope.updateSuccess = 'Saved';
			},
			error: (m, e) => {
				this.scope.updateError = e.responseText;
			},
		});
	},
	scramblePassword: function(e) {
		e.preventDefault();
		if (confirm('Are you sure you want to scramble the password for: '
								+this.user.get('username')+'?')) {
			this.scope.updateError = null;
			this.scope.updateSuccess = null;
			this.user.save({password: false}, {patch: true, wait: true,
				success: function() {
					//console.log("YAY!", arguments)
					this.scope.updateSuccess = 'Saved';
				},
			});
		}
	},
	delUser: function() {
		if (confirm('Are you sure you want to delete '+
			this.user.get('username')+'?')) {
			this.user.destroy();
			Feedback.Router.navigate('/admin', {trigger: true});
		}
	},
});
