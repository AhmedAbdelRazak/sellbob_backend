/** @format */

const express = require("express");
const router = express.Router();
const { requireSignin, isAuth, isHotelOwner } = require("../controllers/auth");
const {
	upload,
	remove,
	uploadCommentImage,
	removeCommentImage,
} = require("../controllers/cloudinary");
const { userById } = require("../controllers/user");
router.post(
	"/admin/uploadimages",
	// requireSignin,
	// isAuth,
	// isHotelOwner,
	upload
);
router.post(
	"/admin/removeimage",
	// requireSignin,
	// isAuth,
	// isHotelOwner,
	remove
);

router.post(
	"/admin/uploadimagesimagecomment/:userId",
	requireSignin,
	isAuth,
	uploadCommentImage
);
router.post(
	"/admin/removeimagecomment/:userId",
	requireSignin,
	isAuth,
	removeCommentImage
);

router.param("userId", userById);

module.exports = router;
