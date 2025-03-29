/** @format */

const express = require("express");
const router = express.Router();
const {
	requireSignin,
	isAuth,
	isHotelOwner,
	isAdmin,
} = require("../controllers/auth");
const { userById } = require("../controllers/user");

const {
	create,
	propertyTypeById,
	read,
	list,
	listForAdmin,
	updatePropertyDetails,
	listOfPropertyUser,
	listOfAgentProperties,
	listOfActivePropertiesForUser,
	updatePropertyStatus,
	updatePropertyFeatured,
	listOfActiveFeaturedProperties,
	toggleWishlist,
	addPropertyView,
	listOfPropertiesToSpecificAgent,
	listOfFilteredProperties,
} = require("../controllers/property_details");

router.get("/property-details/:propertyDetailsId", read); // Consolidated into a single route

router.post(
	"/new-property-details/create/:userId",
	requireSignin,
	isHotelOwner,
	create
);

router.get("/property-details/account/:accountId", list); // Adjusted for clarity
router.get(
	"/list-of-agent-properties/:userId",
	requireSignin,
	isHotelOwner,
	listOfAgentProperties
);
router.get("/property-details/super-admin/:accountId", listOfPropertyUser);
router.get(
	"/property-details/admin/:userId",
	requireSignin,
	isAdmin,
	listForAdmin
);

router.put(
	"/property-details/admin/update-status/:userId/:propertyId",
	requireSignin,
	isAdmin,
	updatePropertyStatus
);

router.put(
	"/property-details/admin/update-featured/:userId/:propertyId",
	requireSignin,
	isAdmin,
	updatePropertyFeatured
);

router.get("/list-of-filtered-properties", listOfFilteredProperties);
router.get("/list-of-agent-properties-active", listOfActivePropertiesForUser);
router.get(
	"/property/list-of-agent-properties-active-public-page/:agentId",
	listOfPropertiesToSpecificAgent
);
router.get(
	"/list-of-agent-properties-active-featured",
	listOfActiveFeaturedProperties
);

router.put(
	"/property-details/update/:propertyId/:userId",
	requireSignin,
	isHotelOwner,
	updatePropertyDetails
);

router.post(
	"/property/:propertyId/wishlist/:userId/:propertyId",
	requireSignin,
	isAuth,
	toggleWishlist
);

router.post("/property-details/view/:propertyDetailsId", addPropertyView);

router.param("userId", userById);
router.param("propertyDetailsId", propertyTypeById);

module.exports = router;
