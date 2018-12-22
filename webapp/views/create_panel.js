// CreatePanel

// require('styles/create_panel.css');

module.exports = Backbone.View.extend({
	id: 'CreatePanel',
	className: 'container',
	template: `
		<div rv-each-query="form:queries" class="row">
			<div class="col-md-12">
				<input class="" rv-value="query"></input>
			</div>
		</div>
		<form>
			<div class="form-group">
				<label for="data">RAW FORM JSON:</label>
				<textarea id="data" class="form-control" rows="5"></textarea>
			</div>
			<label class="checkbox-inline"><input type="checkbox" value="publix">Public</label>
			<!-- TODO: expiration.. -->
			<div class="form-group has-error">
				<span class="control-label">{ error }</span>
			</div>
			<input type="submit" value="Create Form" class="btn btn-default">
		</form>
		</div>
	`,
	events: {
		'click [type="submit"]': 'createForm',
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
	createForm: function(e) {
		//TODO: implement
	},
});
