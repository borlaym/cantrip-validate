var cantrip = require("Cantrip");
var validation = require("./index.js");

cantrip.use(validation);
cantrip.use(function(err, req, res, next) {
	if( Object.prototype.toString.call( err ) === '[object Array]' ) {
		res.status(400).send({
			error: "Validation error",
			stack: err
		});
	} else {
		next(err);
	}
});

cantrip.start();