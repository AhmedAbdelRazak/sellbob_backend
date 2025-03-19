/**
 * Support Case Routes
 *
 * These endpoints handle:
 *  - Creating cases
 *  - Fetching open/closed cases
 *  - Marking messages as seen
 *  - Deleting specific messages
 */

const express = require("express");
const router = express.Router();
const supportCaseController = require("../controllers/supportcase");
const {
	requireSignin,
	isHotelOwner,
	isAuth,
	isAdmin,
} = require("../controllers/auth");
const { userById } = require("../controllers/user");

// Middleware to attach io to req for Socket.IO usage
const attachIo = (req, res, next) => {
	req.io = req.app.get("io");
	next();
};

/**
 * Create a new support case
 */
router.post(
	"/support-cases/new",
	attachIo,
	supportCaseController.createNewSupportCase
);

/**
 * Fetch open support cases (admin or agent opened)
 */
router.get(
	"/support-cases/active/:userId",
	requireSignin,
	isHotelOwner,
	supportCaseController.getOpenSupportCases
);

/**
 * Fetch open support cases by clients only
 */
router.get(
	"/support-cases-clients/active/:userId",
	requireSignin,
	isHotelOwner,
	supportCaseController.getOpenSupportCasesClients
);

/**
 * Fetch open support cases for a specific property
 */
router.get(
	"/support-cases-properties/active/:propertyId",
	supportCaseController.getOpenSupportCasesForProperty
);

/**
 * Fetch closed support cases (admin or agent opened)
 */
router.get("/support-cases/closed", supportCaseController.getCloseSupportCases);

/**
 * Fetch closed support cases by clients (global)
 */
router.get(
	"/support-cases/closed/clients/:userId",
	supportCaseController.getCloseSupportCasesClients
);

/**
 * Fetch closed support cases for a specific property (admin or agent opened)
 */
router.get(
	"/support-cases-properties/closed/:propertyId",
	supportCaseController.getCloseSupportCasesForProperty
);

/**
 * Fetch closed support cases for a specific property, client opened
 */
router.get(
	"/support-cases-properties-clients/closed/:propertyId",
	supportCaseController.getCloseSupportCasesForPropertyClients
);

/**
 * Get a specific support case by ID
 */
router.get("/support-cases/:id", supportCaseController.getSupportCaseById);

/**
 * Update a support case (add message, change status, etc.)
 */
router.put(
	"/support-cases/:id",
	attachIo,
	supportCaseController.updateSupportCase
);

/**
 * Fetch unseen messages count by super admin
 * (Using query param ?userId=xxx)
 */
router.get(
	"/support-cases/:propertyId/unseen/admin-owner",
	supportCaseController.getUnseenMessagesCountByAdmin
);

/**
 * Fetch unseen messages count by agent (property owner)
 */
router.get(
	"/support-cases/:propertyId/unseen/agent",
	supportCaseController.getUnseenMessagesCountByAgent
);

/**
 * Fetch unseen messages by regular client
 */
router.get(
	"/support-cases-client/:clientId/unseen",
	supportCaseController.getUnseenMessagesByClient
);

/**
 * Update seen status for Admin or Agent
 */
router.put(
	"/support-cases/:id/seen/admin-agent",
	supportCaseController.updateSeenStatusForAdminOrAgent
);

/**
 * Update seen status for Client
 */
router.put(
	"/support-cases/:id/seen/client",
	supportCaseController.updateSeenStatusForClient
);

/**
 * Count all unseen (super admin) messages
 */
router.get(
	"/support-cases/unseen/count",
	supportCaseController.getUnseenMessagesCountByAdmin
);

/**
 * Mark all messages as seen by Admin in a single case
 */
router.put(
	"/support-cases/:id/seen-by-admin",
	supportCaseController.markAllMessagesAsSeenByAdmin
);

/**
 * Mark all messages as seen by Agent in a single case
 */
router.put(
	"/support-cases/:id/seen-by-agent",
	supportCaseController.markAllMessagesAsSeenByAgent
);

/**
 * Mark all messages in all cases as seen by everyone
 */
router.put(
	"/mark-all-cases-as-seen",
	supportCaseController.markEverythingAsSeen
);

/**
 * Delete a specific message from a case's conversation
 */
router.delete(
	"/support-cases/:caseId/messages/:messageId",
	attachIo,
	supportCaseController.deleteMessageFromConversation
);

router.put(
	"/support-cases/:id/seen-by-agent",
	supportCaseController.markAllMessagesAsSeenByAgent
);

router.get(
	"/admin/support-cases/b2c/open/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	supportCaseController.adminGetActiveB2C
);
router.get(
	"/admin/support-cases/b2c/closed/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	supportCaseController.adminGetClosedB2C
);
router.get(
	"/admin/support-cases/b2b/open/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	supportCaseController.adminGetActiveB2B
);
router.get(
	"/admin/support-cases/b2b/closed/:userId",
	requireSignin,
	isAuth,
	isAdmin,
	supportCaseController.adminGetClosedB2B
);

router.param("userId", userById);

module.exports = router;
