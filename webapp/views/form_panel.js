// FormPanel

require('styles/form_panel.css');

module.exports = Backbone.View.extend({
	id: 'FormPanel',
	className: 'container',
	template: `
		<div rv-each-query="form:queries" class="row">
			<div class="col-md-12">
				<input class="" rv-value="query"></input>
			</div>
		</div>
		<div rv-hide="form:data">
			<p rv-show="form.loading">
				loading form ...
			</p>
			<p rv-hide="form.loading">
				No form with this name!
				<a rv-show="user.isAuthed" href="#">
					create a new one
				</a>
				<a rv-hide="user.isAuthed" href="#">
					login to create one
				</a>
			</p>
			<p rv-hide="form.loading">
				//TODO: show recents
			</p>
		</div>
	`,
	events: {
		'click .open-door': 'openDoor',
	},
	// initialize: function() {},
	loading: true,
	render: function() {
		if (!this.form || this.form.id !== Feedback.Router.args[0]) {
			this.form = new (Backbone.Model.extend({
				urlRoot: '/api/v1/forms/',
			}))({
				id: Feedback.Router.args[0],
			});
			this.form.loading = true;
			this.form.on('sync', (a,b,c) => {
				this.form.loading = false;
				this.render();
			});
			this.form.fetch({
				error: () => {
					this.form.loading = false;
					this.render();
				},
			});
		}
		//TODO: cache answers in local storage
		this.scope = {
			form: this.form,
		};
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		return this;
	},
	createFeedback: function(e) {
		//TODO: implement
	},
});
