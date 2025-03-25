/** @format */

const express = require("express");
const router = express.Router();

const {
	signup,
	signin,
	signout,
	forgotPassword,
	resetPassword,
	googleLogin,
	propertySignup,
	facebookLogin,
} = require("../controllers/auth");

router.post("/signup", signup);
router.post("/property-listing", propertySignup);
router.post("/signin", signin);
router.get("/signout", signout);

router.put("/forgot-password", forgotPassword);
router.put("/reset-password", resetPassword);

// Social logins
router.post("/google-login", googleLogin);
router.post("/facebook-login", facebookLogin); // NEW

module.exports = router;
