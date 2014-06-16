var _ = require("lodash");

var validations = {};
validations.string = require("./types/string");
validations.boolean = require("./types/boolean");
validations.number = require("./types/number");


var validate = {
	getSchema: function() {
		if (this.data._schema !== undefined) {
			return this.data._schema;
		} else {
			return false;
		}
	},
	/**
	 * The wrapper method for validation. Creates a Request object, then checks if we have validation in our JSON.
	 * If we do, it runs the data through it, returning either true or false based on whether the data passed the test or not.
	 * If the JSON doesn't support validation, it automatically returns true.
	 * @param  {Object} request From Express
	 * @param  {Object} response From Express
	 * @return {boolean}
	 */
	validate: function(request, response) {
		var req = new Request(request, response);
		var validation = this.getValidation("root", req);
		if (validation) {
			return this.validateObject(request.body, validation, req);
		} else {
			return true;
		}
	},
	/**
	 * Gets a validation object from the metadata.
	 * @param  {String} typeName The name of the validation object. The ke "root" is special and signifies the whole JSON object
	 * @param  {Object} req      The Request object
	 * @return {Object}          Returns a validation object. If it doesn't exists, returns false.
	 */
	getValidation: function(typeName, req) {
		var metadata = this.getSchema();
		if (metadata) {
			//When we check the root, we go through the metadata following the path.
			//When we use this function later to dig into another type in the schema, we just return that object
			if (typeName !== "root") {
				return metadata[typeName];
			}
			var validation = metadata[typeName];
			//go through the metadata following the path
			for (var i = 0; i < req.path.length; i++) {
				if (validation[req.path[i]] !== undefined) {
					validation = validation[req.path[i]];
					//if it's an object, get out of the current type and search for that type on the metadata root
					if (validation.type === "object") {
						validation = metadata[validation.schema];
					} else if (validation.type === "collection") {
						validation = metadata[validation.schema];
					}
				} else {
					//We are in a model inside a collection
					validation = validation;
				}
			}
			return validation;
		} else {
			return false;
		}
	},
	validateObject: function(object, validation, req) {
		//If object is not an object return error
		if (!_.isObject(object)) {
			req.response.status(400).send({
				"error": "Type error. Expected object, found " + object + "."
			});
			return false;
		}
		//If the posted object doesn't contain all keys needed for the validation, throw an error
		//But only if the object is not equal to the request body, because when we PUT the object, we don't want to specify all keys
		for (var key in validation) {
			if (object[key] === undefined && object !== req.request.body) {
				req.response.status(400).send({
					"error": "Type error. Missing key "+key+"."
				});
				return false;
			}
		}
		//Loop through the keys in the posted object
		for (var key in object) {
			var v = validation[key];
			//return false if we try to validate a key that doesn't exist in the schema
			if (v === undefined) {
				req.response.status(400).send({
					"error": "Type error. Invalid key "+key+" in object."
				});
				return false;
			}
			//Check type
			if (!this.checkType(object[key], v, req)) {
				var correctType = v.type === "object" || v.type === "collection" ? v.schema : v.type;
				req.response.status(400).send({
					"error": "Type error. Key " + key + " must be of type " + correctType
				});
				return false;
			}
			
			//Now run all custom validations defined in an array in the key "validation"
			if (v.validation) {
				var customValidation = validations[v.type].validate(object[key], v.validation);
				if (!customValidation.valid) {
					req.response.status(400).send({
						"error": "Validation error with key "+key+". " + customValidation.message
					});
					return false;
				}
			}
		}
		return true;
	},
	checkType: function(value, validation, req) {
		var type = validation.type;
		if (type === "boolean") {
			if (_.isBoolean(value)) return true;
			else return false;
		} else if (type === "string") {
			if (_.isString(value)) return true;
			else return false;
		} else if (type === "number") {
			if (_.isNumber(value)) return true;
			else return false;
		} else if (type === "object") {
			//If we specified a schema, then the object must be of a given shema. If we didn't, its free for all!
			if (validation.schema === undefined && _.isObject(value)) return true;
			if (this.validateObject(value, this.getValidation(validation.schema, req), req)) return true;
			else return false;
		} else if (type === "collection") {
			if (validation.schema === undefined && _.isArray(value)) return true;
			else {
				if (_.indexOf(["string", "number", "boolean"], validation.schema) > -1) {
					var valid = true;
					for (var i = 0; i < value.length; i++) {
						if (!this.checkType(value[i], {
							type: validation.schema
						}, req)) valid = false;
					}
					return valid;
				} else {
					var valid = true;
					for (var i = 0; i < value.length; i++) {
						if (!_.isObject(value[i])) valid = false;
						if (!this.validateObject(value[i], this.getValidation(validation.schema, req), req)) valid = false;
					}
					return valid;
				}
			}
		}
	}
}

module.exports = Cantrip;