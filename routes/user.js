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
	houseKeepingStaff,
	allHotelAccounts,
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
	"/all-hotel-accounts/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	allHotelAccounts
);
router.get(
	"/account-data/:accountId/:userId",
	requireSignin,
	isAuth,
	getSingleUser
);

router.put(
	"/user/:updatedUserId/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	updateUserByAdmin
);
router.get("/house-keeping-staff/:hotelId", houseKeepingStaff);

router.param("userId", userById);
router.param("updatedUserId", updatedUserId);

module.exports = router;
