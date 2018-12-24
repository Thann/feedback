// FormPanel

require('styles/form_panel.css');

module.exports = Backbone.View.extend({
	id: 'FormPanel',
	className: 'container',
	template: `
		<div rv-hide="form.attributes.data">
			<br>
			<p rv-show="form.loading">
				loading form ...
			</p>
			<h4 rv-hide="form.loading">
				ERROR: No form with this id!
				<a rv-show="user.isAuthed" href="#create">
					create a new one
				</a>
				<a rv-hide="user.isAuthed" href="#">
					login to create one
				</a>
			</h4>
		</div>
		<form rv-show="form.attributes.data">
			<h3>
				<span rv-text="form.attributes.data.title |or form.attributes.data.name"></span>
				<a rv-href="'#' |+ form.id |+ '/feedback'" rv-show="admin" class="fa fa-external-link"></a>
			</h3>
			<p>{ form.attributes.data.description }</p>
			<div rv-each-entry="form.attributes.data.entries" class="panel panel-default">
				<div class="panel-heading">
					<div class="panel-title">
						{ entry.index |+ 1 }. { entry.title }
					</div>
				</div>
				<div class="panel-body">
					<p rv-show="entry.description">{ entry.description }</p>
					<ol rv-show="entry.options" rv-type="entry.type |or 'A'">
						<li class="form-check" rv-each-option="entry.options">
							<input class="form-check-input" type="checkbox"
								rv-name="entry.index" rv-value="'' |+ $index"
								rv-id="entry.index |+ '.' |+ $index">
							<label class="form-check-label"
								rv-for="entry.index |+ '.' |+ $index">
								{ option  |or '&nbsp;'}
							</label>
						</li>
						<li class="form-check check-dummy" rv-show="entry.other">
							<input class="form-check-input" type="checkbox">
							<textarea rv-name="entry.index"
								rv-placeholder="entry.other |or 'Type your answer here...'"></textarea>
						</li>
					</ol>
					<textarea rv-if="entry.options |length |or 0 |lt 1" rv-name="entry.index" rows="3"
						rv-placeholder="entry.other |or 'Type your answer here...'"></textarea>
				</div>
			</div>
			<div rv-show="error" class="form-group alert alert-danger">
				<span class="control-label">{ error }</span>
			</div>
			<div class="form-group">
				<input type="submit" class="btn btn-default" value="Submit Feedback">
				<span class="status fa fa-check text-success hidden"></span>
			<div>
		</form>
	`,
	events: {
		'click .btn.edit': 'edit',
		'click [type="submit"]': 'createFeedback',
		'keyup .check-dummy textarea': 'checkDummy',
	},
	loading: true,
	render: function() {
		if (!this.form || this.form.id !== Feedback.Router.args[0]) {
			//TODO: cache answers in local storage
			this.form = new (Backbone.Model.extend({
				urlRoot: '/api/v1/forms/',
				parse: function(form) {
					if (form.data.entries) {
						for (const [i, entry] of form.data.entries.entries()) {
							entry.index = i;
						}
					}
					return form;
				},
			}))({
				id: Feedback.Router.args[0],
			});
			this.form.loading = true;
			this.form.fetch({
				error: () => {
					this.form.loading = false;
					this.render();
				},
			});
		}
		//TODO: show previous feedback
		// if (!this.feedback || this.feedback.id !== Feedback.User.id) {
		// }

		this.scope = {
			form: this.form,
			user: Feedback.User,
			admin: Feedback.User.get('admin') ||
				Feedback.User.id === this.form.get('user_id'),
		};
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		return this;
	},
	edit: function(e) {
		//TODO: implement
	},
	createFeedback: function(e) {
		//TODO: implement
		e.preventDefault();
		this.scope.error = null;
		const responses = {};
		this.$('.status')
			.removeClass('hidden')
			.removeClass(function(i, cname) {
				return (cname.match (/\bfa-\S+/g) || []).join(' ');
			});

		for (const r of this.$('form').serializeArray()) {
			if (!r.value) continue;
			if (!(r.name in responses))
				responses[r.name] = [r.value];
			else
				responses[r.name].push(r.value);
		}
		if (!Object.keys(responses).length) {
			this.scope.error = 'Please fill out the form';
			return;
		}
		const feedback = new (Backbone.Model.extend({
			urlRoot: '/api/v1/forms/'+this.form.id+'/feedbacks',
		}))({ data: { responses } });
		feedback.save(undefined, {
			success: () => {
				this.$('.status').addClass('fa-check');
				this.$('.status').removeClass('fa-spinner');
			},
			error: (e) => {
				this.scope.error = 'ERROR: '+e;
				this.$('.status').addClass('hidden');
			},
		});
		this.$('.status').addClass('fa-spinner');
	},
	checkDummy: function(e) {
		//TODO: doesnt re-check
		this.$(e.currentTarget).siblings('input').attr('checked', 'checked');
	},
});
