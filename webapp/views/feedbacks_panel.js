// FeedbacksPanel - List & analyze feedbacks for a form

// require('styles/feedbacks_panel.css');

module.exports = Backbone.View.extend({
	id: 'FeedbacksPanel',
	className: 'container',
	template: `
		<h3>Feedback:
			<span rv-text="form.attributes.data.title |or form.attributes.data.name"></span>
			<a rv-href="'#' |+ form:id" class="fa fa-external-link"></a>
		</h3>
		<div rv-each-fb="form.feedbacks">
			User: { fb:username },
			<span rv-each-resp="fb:data.responses |to_a">{ resp.key }: { resp.value }, </span>
		</div>
	`,
	render: function() {
		const view = this;
		if (!this.form || this.form.id !== Feedback.Router.args[0]) {
			this.form = new (Backbone.Model.extend({
				// idAtttibute: 'hash',
				urlRoot: '/api/v1/forms',
				initialize: function(options) {
					this.feedbacks = new (Backbone.Collection.extend({
						url: this.url() + '/feedbacks',
					}))();
					this.on('sync', () => {
						this.feedbacks.fetch({success: function() {
							//TODO:
							view.render();
						}});
					});
				},
			}))({
				id: Feedback.Router.args[0],
			});
			this.form.fetch();
		}

		this.scope = {
			form: this.form,
		};
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		return this;
	},
});
