// CreatePanel

// require('styles/create_panel.css');

const sampleFormData = `{
	"name":"Sample Survey Name",
	"title":"Survey Title (optional)",
	"description":"more info",
	"entries":[{
		"title":"sample question",
		"description":"more info",
		"other": "placeholder",
		"options": [
			"Option One",
			"Option Two"
		]
	}, {
		"title":"text-only question"
	}]
}`;

module.exports = Backbone.View.extend({
	id: 'CreatePanel',
	className: 'container',
	template: `
		<h3>Create Form</h3>
		<form>
			<div class="form-group">
				<label for="data">RAW FORM JSON:</label>
				<textarea id="data" name="data" class="form-control" rows="12"
					rv-value="sampleFormData"></textarea>
			</div>
			<label class="checkbox-inline">
				<input type="checkbox" name="public" value="true" checked>
				Public
			</label>
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
	loading: true,
	sampleFormData,
	render: function() {
		this.scope = { sampleFormData };
		this.$el.html(this.template);
		Rivets.bind(this.$el, this.scope);
		return this;
	},
	createForm: function(e) {
		e.preventDefault();
		this.scope.error = null;
		const data = this.$('form').serializeObject();
		try {
			data.data = JSON.parse(data.data);
		} catch(e) {
			this.scope.error = 'INVALID JSON';
		}
		this.form = new (Backbone.Model.extend({
			url: '/api/v1/forms',
		}))(data);
		this.form.save(null, {success: function() {
			//TODO: navigate to form!
		}, error: function() {
			//ODO: show error msg!
		}});
	},
});
