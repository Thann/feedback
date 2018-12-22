// AdminPanel

module.exports = Backbone.View.extend({
	id: 'AdminPanel',
	className: 'container',
	template: `
		<div class="settings panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".settings .panel-collapse">
				<div class="panel-title">
					Site Settings:
				</div>
			</div>
			<div class="panel-collapse collapse">
				<div class="panel-body">
					<table>
						<form class="public">
							<tr rv-each-attr="settings.attributes |to_a">
								<td rv-text="attr.key"></td>
								<td>
									<input rv-value="attr.value">
								</td>
							</tr>
						</form>
						<form class="private">
							<tr rv-each-attr="privateSettings.attributes |to_a">
								<td rv-text="attr.key"></td>
								<td>
									<input rv-value="attr.value">
								</td>
							</tr>
						</form>
					</table>
				</div>
				<div class="panel-footer">
					<input type="submit" value="Update" class="update btn btn-default">
					<div class="error" rv-text="settingsError"></div>
				</div>
			</div>
		</div>

		<div class="users panel panel-default">
			<div class="panel-heading" data-toggle="collapse" data-target=".users .panel-collapse">
				<div class="panel-title">
					Users:
					<a class="toggle new fa fa-plus"></a>
				</div>
			</div>

			<div class="panel-collapse collapse in">
				<div class="panel-body">
					<form rv-show="creatingUser">
						<input type="text" name="name" placeholder="Name" required>
						<input type="submit" class="new btn btn-default" value="Create">
						<div class="error" rv-text="userError"></div>
					</form>
					<div rv-each-user="users">
						<a rv-href="'#user/' |+ user:username" rv-text="user:username"></a>
						<span rv-text="user:password"></span>
						<a rv-show="user:password |and user:id |gt 1" target="_blank"
							rv-href="mailto |+ user:username |+ ' ' |+ user:password |+ mail2">
							[Send Email]
						</a>
					</div>
				</div>
			</div>
		</div>
	`,
	events: {
		'click .doors .new': 'createDoor',
		'click .users .new': 'createUser',
		'click .settings .update': 'updateSettings',
	},
	initialize: function() {
		if (!Feedback.User.get('admin')) {
			// console.log("NOT ADMIN!!");
			return Feedback.Router.navigate('', {trigger: true});
		}

		this.users = new (Backbone.Collection.extend({
			url: '/api/v1/users',
		}))();
		//TODO: render should not be nessicary
		this.listenTo(this.users, 'sync', this.render);
		this.users.fetch();

		this.privateSettings = new (Backbone.Model.extend({
			url: '/api/v1/site/private_settings',
		}))();
		this.privateSettings.fetch({success: _.bind(function() {
			this.render();
		}, this)});
	},
	render: function() {
		// console.log("RENDER MAIN:", Feedback.User.get('admin'))
		this.scope = {
			doors: this.doors,
			users: this.users,
			settings: Feedback.Settings,
			privateSettings: this.privateSettings,
			mailto: "mailto:?subject=Feedback&body=Hey! you've been setup on the door. Visit " +
				window.location.toString().replace(window.location.hash, '') +
				' and sign-in with the username and password:%0D%0A%0D%0A',
			mail2: "   (case-sensitive)%0D%0A%0D%0ADon't forget to update your password =]",
		};
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		return this;
	},
	createDoor: function(e) {
		if (e) {
			e.preventDefault();
			if (this.$('.doors .panel-collapse.in').length) {
				e.stopPropagation();
			} else if (this.scope.creatingDoor) {
				//TODO: delayFocus?
				setTimeout(_.bind(function() {
					this.$('.doors input[name]').focus();
				}, this));
				return;
			}
		}

		if (this.$(e.currentTarget).hasClass('toggle')) {
			this.scope.creatingDoor = !this.scope.creatingDoor;
			this.scope.doorError = undefined;
			if (this.scope.creatingDoor) {
				setTimeout(_.bind(function() {
					this.$('.doors input[name]').focus();
				}, this));
			}
		} else {
			// console.log('CREEATING DOOR');
			this.doors.create({
				name: this.$('.doors form [name="name"]').val(),
			}, {wait: true,
				success: _.bind(function() {
					console.log('DOOR CREATE DONE!', this.doors);
					this.scope.creatingDoor = false;
				}, this),
				error: _.bind(function(m, resp) {
					console.warn('DOOR CREATE ERR!', resp.responseText);
					this.scope.doorError = resp.responseText;
				}, this),
			});
		}
	},
	//TODO: door_panel
	// editDoor: function(e) {
	// 	var id = $(e.currentTarget).data('id');
	// 	if (!this.scope.editingDoor) {
	// 		this.scope.editingDoor = id;
	// 		self.scope.error = undefined;
	// 	} else {
	// 		var door = this.doors.find({id: id});
	// 		// door.sync(null, this, {url: door.url()+'/open', method: 'PO
	// 	}
	// },
	// deleteDoor: function(e) {
	// 	this.doors.find({id: this.$(e.currentTarget).data('id')}).destroy();
	// },
	createUser: function(e) {
		if (e) {
			e.preventDefault();
			if (this.$('.users .panel-collapse.in').length) {
				e.stopPropagation();
			} else if (this.scope.creatingUser) {
				//TODO: delayFocus?
				setTimeout(_.bind(function() {
					this.$('.doors input[name]').focus();
				}, this));
				return;
			}
		}

		if (this.$(e.currentTarget).hasClass('toggle')) {
			this.scope.creatingUser = !this.scope.creatingUser;
			this.scope.userError = undefined;
			if (this.scope.creatingUser) {
				setTimeout(_.bind(function() {
					this.$('.users input[name]').focus();
				}, this));
			}
		} else {
			this.users.create({
				username: this.$('.users form [name="name"]').val(),
			}, {wait: true,
				success: _.bind(function(m) {
					console.log('USER CREATE DONE!', arguments);
					this.scope.creatingUser = false;
					Feedback.Router.navigate('/user/'+m.get('username'),
						{trigger: true});
				}, this),
				error: _.bind(function(m, resp) {
					console.warn('USER CREATE ERR!', resp.responseText);
					this.scope.userError = resp.responseText;
				}, this),
			});
		}
	},
	updateSettings: function() {
		const publicSettings = this.$('.settings form.public');
		const privateSettings = this.$('.settings form.private');

		//TODO:
		console.log('publicSettings', publicSettings);
		console.log('privateSettings', privateSettings);
	},
});
