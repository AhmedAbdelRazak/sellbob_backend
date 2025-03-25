/** @format */

const express = require("express");
const router = express.Router();
const {
	requireSignin,
	isAuth,
	isAdmin,
	isHotelOwner,
} = require("../controllers/auth");

const {
	userById,
	read,
	update,
	allUsersList,
	updateUserByAdmin,
	updatedUserId,
	getSingleUser,
} = require("../controllers/user");

router.get("/secret/:userId", requireSignin, isAuth, isAdmin, (req, res) => {
	res.json({
		user: req.profile,
	});
});

router.get("/user/:userId", requireSignin, isAuth, read);
router.put("/user/:userId", requireSignin, isAuth, update);
router.get("/allUsers/:userId", requireSignin, isAuth, isAdmin, allUsersList);

router.get(
	"/account-data/:accountId/:userId",
	requireSignin,
	isAuth,
	getSingleUser
);

router.put(
	"/user-account/:updatedUserId/:userId",
	requireSignin,
	isAuth,
	isHotelOwner,
	updateUserByAdmin
);

router.param("userId", userById);
router.param("updatedUserId", updatedUserId);

module.exports = router;
