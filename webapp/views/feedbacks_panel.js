// FeedbacksPanel - List & analyze feedbacks for a form

require('styles/feedbacks_panel.css');

module.exports = Backbone.View.extend({
	id: 'FeedbacksPanel',
	className: 'container',
	template: `
		<h3>Feedback:
			<span rv-text="form.attributes.data.title |or form.attributes.data.name"></span>
			<a rv-href="'#' |+ form:id" class="fa fa-external-link"></a>
		</h3>
		<table class="table">
			<tr>
				<th>user</th>
				<th>date</th>
				<th rv-each-entry="form.attributes.data.entries">
					{ entry.title }
				</th>
			<tr>
			<tr rv-each-feedback="form.feedbacks"
				rv-class-selected="feedback.id |eq selected">
				<td>{ feedback:username }</td>
				<td rv-text="feedback:created |luxon 'DATE_SHORT'"></td>
				<td rv-each-fb="feedback |formatFeedback">{ fb }</td>
			</tr>
		</table>
		<button class="btn btn-default" rv-enabled="form.feedbacks.hasMore">
			More Feedbacks
		</button>
	`,
	events: {
		'click button': 'moreFeedbacks',
	},
	scroll: true,
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
								},
							});
						},
					}))();
					this.on('sync', () => {
						this.feedbacks.fetchMore();
					});
					//TODO: should not be needed
					view.listenTo(this.feedbacks, 'sync', () => {
						view.render();
					});
				},
			}))({
				id: Feedback.Router.args[0],
			});
			this.form.fetch();
		}

		this.scope = {
			form: this.form,
			selected: Feedback.Router.args[1],
		};
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		if (this.scroll)
			this.$('tr.selected').eq(0).each((i,e) => e.scrollIntoView());
		return this;
	},
	moreFeedbacks() {
		this.scroll = false;
		this.form.feedbacks.fetchMore();
	},
});

Rivets.formatters.formatFeedback = function(feedback) {
	const entries = feedback.attributes.form_data.entries;
	const responses = feedback.attributes.data.responses;
	return entries.map((entry, entryIdx) => {
		return (responses[entryIdx] || []).map((sel) => {
			return entry.options && entry.options[sel] || sel;
		}).join(', ');
	});
};
