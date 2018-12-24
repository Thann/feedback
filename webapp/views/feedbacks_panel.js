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
			<span rv-text="fb:created |luxon 'DATE_SHORT'"></span>
			<span rv-each-resp="fb:data.responses |to_a">{ resp.key }: { resp.value }, </span>
		</div>
	`,
	render: function() {
		const view = this;
		if (!this.form || this.form.id !== Feedback.Router.args[0]) {
			//TODO: dont need form?
			this.form = new (Backbone.Model.extend({
				// idAtttibute: 'hash',
				urlRoot: '/api/v1/forms',
				initialize: function(options) {
					const form = this;
					this.feedbacks = new (Backbone.Collection.extend({
						hasMore: true,
						url: function() {
							const lastID = this.models.length &&
								this.models[this.models.length-1].id || '';
							return form.url()+'/feedbacks?last_id='+lastID;
						},
						//TODO: add button to fetch more!
						fetchMore: function(cb) {
							this.fetch({ add: true, remove: false,
								success: (coll, newLogs) => {
									if (newLogs.length < 50)
										coll.hasMore = false;
									cb && cb();
								},
							});
						},
					}))();
					this.on('sync', () => {
						this.feedbacks.fetchMore(function() {
							//TODO: should not be needed
							view.render();
						});
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
