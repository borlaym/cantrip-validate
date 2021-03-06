var _ = require("lodash");
var fs = require("fs");
var validate = require('jsonschema').validate;

var Validation = {
	/**
	 * Validate the whole request object. Gets the validation schema from the _schema meta object, if one exists.
	 * Then validates the request data, and return an error to the next() method if it's invalid, null otherwise
	 * @param  {Object} request From Express
	 * @param  {Object} response From Express
	 * @return {boolean}
	 */
	validate: function(req, res, next) {
		if (req.method === "GET") return next();
		Validation.getValidation(req, function(schema) {
			var v = validate(req.body, schema);

			//If this is a PUT request, ignore 'required' errors
			if (req.method === "PUT") {
				v.errors = _.filter(v.errors, function(error) {
					return error.message.indexOf("requires ") === -1;
				});
			}

			if (v.errors.length === 0) next();
			else {
				next(v.errors);
			}
		});
	},

	getValidation: function(req, callback) {
		//Get the whole schema for the application
		req.dataStore.get("/_schema", function(err, schema) {
			//If we didnt find anything, return with null
			if (!schema) {
				callback(null);
				return;
			}
			//else we need to loop through it and find the fragment needed for this request
			var path = (req.path + "").replace("/_contents", "").split("/");
			if (_.last(path) === "") path.pop(); 
			path.splice(0,1);
			while (path.length > 0) {
				var node = path.splice(0,1);
				if (schema.type === "object") {
					schema = schema.properties[node];
				} else {
					schema = schema.items;
				}
			}

			//if the request is a POST to an array, we need to make an additional step
			if (req.method === "POST") schema = schema.items;
			callback(schema);

		});
	}
}
module.exports = Validation.validate;
