/**
 * Support Case Controller
 *
 * Provides CRUD operations and additional functionality
 * for the real estate SupportCase system, including:
 * - Creating new cases
 * - Updating case status, adding conversation messages
 * - Tracking unseen messages per role
 * - Fetching open/closed cases (for properties, agents, clients)
 */

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const sgMail = require("@sendgrid/mail");
const twilio = require("twilio");

// Load environment config
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const supportCaseEmail = twilio(
	process.env.TWILIO_ACCOUNT_SID,
	process.env.TWILIO_AUTH_TOKEN
);

// Import Models
const SupportCase = require("../models/supportcase");
const PropertyDetails = require("../models/property_details");
const User = require("../models/user");

// Example email template function (Adjust as needed)
const { newSupportCaseEmail } = require("./assets");

/**
 * Get all support cases accessible to the current user.
 * - SuperAdmin sees all
 * - Others see only cases where they are involved (not fully implemented below; adjust if needed)
 */
exports.getSupportCases = async (req, res) => {
	try {
		const userId = req.user._id;
		const role = req.user.role;

		let cases;
		if (role === "SuperAdmin") {
			// Super admin sees all cases
			cases = await SupportCase.find()
				.populate("supporterId") // from the schema
				.populate("propertyId");
		} else {
			// For simplicity, filter by property or user if needed
			// Adjust logic as you wish (e.g., if agent or client)
			cases = await SupportCase.find({
				$or: [
					{ supporterId: userId },
					// If you also store "agentId" or "ownerId" in the doc, add that here
					// { agentId: userId }, etc.
				],
			})
				.populate("supporterId")
				.populate("propertyId");
		}

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get a specific support case by ID
 */
exports.getSupportCaseById = async (req, res) => {
	try {
		const supportCase = await SupportCase.findById(req.params.id)
			.populate("supporterId")
			.populate("propertyId");

		if (!supportCase) {
			return res.status(404).json({ error: "Support case not found" });
		}

		// Restrict if agent
		if (req.user.role === "Agent") {
			if (
				!supportCase.supporterId ||
				supportCase.supporterId.toString() !== req.user._id.toString()
			) {
				return res.status(403).json({ error: "Forbidden" });
			}
		}

		// Otherwise superadmin or others can see
		return res.status(200).json(supportCase);
	} catch (error) {
		return res.status(400).json({ error: error.message });
	}
};

/**
 * Update a support case (e.g., add a new message, change status, etc.)
 */
exports.updateSupportCase = async (req, res) => {
	try {
		const {
			supporterId,
			caseStatus,
			conversation,
			closedBy,
			rating,
			supporterName,
			propertyId,
		} = req.body;

		const updateFields = {};

		// Conditionals for only the fields provided
		if (supporterId) updateFields.supporterId = supporterId;
		if (caseStatus) updateFields.caseStatus = caseStatus;
		if (conversation) {
			// If a new message is sent, push to conversation array
			updateFields.$push = { conversation: conversation };
		}
		if (closedBy) updateFields.closedBy = closedBy;
		if (rating) updateFields.rating = rating;
		if (supporterName) updateFields.supporterName = supporterName;
		if (propertyId) updateFields.propertyId = propertyId;

		if (Object.keys(updateFields).length === 0) {
			return res
				.status(400)
				.json({ error: "No valid fields provided for update" });
		}

		// 1) Update the case
		const updatedCase = await SupportCase.findByIdAndUpdate(
			req.params.id,
			updateFields,
			{ new: true }
		);

		if (!updatedCase) {
			return res.status(404).json({ error: "Support case not found" });
		}

		// 2) If the case is closed, populate propertyId.belongsTo before emitting
		if (caseStatus === "closed") {
			// Re-fetch with population
			const populatedClosedCase = await SupportCase.findById(updatedCase._id)
				.populate({
					path: "propertyId",
					select: "belongsTo", // so we can attach targetAgentId
				})
				.exec();

			// Build the payload for front-end
			const belongsTo =
				populatedClosedCase?.propertyId?.belongsTo?.toString() || null;

			const eventPayload = {
				case: {
					...populatedClosedCase.toObject(),
					targetAgentId: belongsTo,
				},
				closedBy,
			};

			// Emit to everyone; only the correct agent + super admin will handle it
			req.io.emit("closeCase", eventPayload);
		} else if (conversation) {
			// 3) If only a new message was added, emit "receiveMessage"
			req.io.emit("receiveMessage", updatedCase);
		}

		res.status(200).json(updatedCase);
	} catch (error) {
		console.log("Error in updateSupportCase:", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Create a new support case
 */
exports.createNewSupportCase = async (req, res) => {
	try {
		const {
			customerName,
			customerEmail,
			inquiryAbout,
			inquiryDetails,
			supporterId, // Possibly your admin or default support user
			ownerId, // The property owner or agent’s ID if relevant
			propertyId,
			role, // The role of user creating the case: 1000=super admin, 2000/3000/7000=agent, else client
			displayName1,
			displayName2,
			supporterName,
		} = req.body;

		console.log("Received Payload:", req.body);

		// Basic validation
		if (
			!customerName ||
			!inquiryAbout ||
			!inquiryDetails ||
			!supporterId ||
			!ownerId ||
			!displayName1 ||
			!displayName2
		) {
			return res.status(400).json({ error: "All fields are required" });
		}

		// Determine who opened the case
		let openedBy = "client"; // default
		if (role === 1000) {
			openedBy = "super admin";
		} else if (role === 2000 || role === 3000 || role === 7000) {
			openedBy = "agent";
		}

		// First conversation entry
		const conversation = [
			{
				messageBy: {
					customerName,
					customerEmail: customerEmail || "no-email@example.com",
					userId: role === 1000 ? supporterId : ownerId,
				},
				message:
					openedBy === "client"
						? "A representative will be with you in 3 to 5 minutes."
						: `New support case created by ${
								openedBy === "super admin"
									? "Platform Administration"
									: openedBy
						  }`,
				inquiryAbout,
				inquiryDetails,
				seenByAdmin: role === 1000,
				seenByAgent: role === 2000 || role === 3000 || role === 7000,
				seenByClient: openedBy === "client",
			},
		];

		// Build the support case doc
		const newCase = new SupportCase({
			supporterId,
			propertyId,
			caseStatus: "open",
			openedBy,
			conversation,
			displayName1,
			displayName2,
			supporterName,
		});

		// 1) Save to DB
		await newCase.save();

		// 2) Populate propertyId to get 'belongsTo'
		const populatedCase = await SupportCase.findById(newCase._id).populate({
			path: "propertyId",
			select: "belongsTo propertyName",
		});

		// 3) Attach a 'targetAgentId' to the event payload if the property belongs to an agent
		const belongsTo = populatedCase?.propertyId?.belongsTo?.toString() || null;
		const eventPayload = {
			...populatedCase.toObject(),
			targetAgentId: belongsTo, // for front-end filtering
		};

		// 4) Emit Socket.IO event for new chat (broadcast to everyone)
		// The front-end will ignore it unless 'targetAgentId' matches their user._id (or if super admin)
		req.io.emit("newChat", eventPayload);

		// 5) Fetch the property's name for the email subject/body
		let propertyName = "Unknown Property";
		if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
			const propertyDoc = await PropertyDetails.findById(propertyId).select(
				"propertyName"
			);
			if (propertyDoc && propertyDoc.propertyName) {
				propertyName = propertyDoc.propertyName;
			}
		}

		// 6) Generate the HTML from your email template
		const emailHtml = newSupportCaseEmail(newCase, propertyName);

		// 7) Send the email notification
		await sgMail.send({
			from: "noreply@jannatbooking.com",
			to: ["ahmed.abdelrazak@jannatbooking.com"],
			subject: `New Support Case | ${propertyName}`,
			html: emailHtml,
		});

		return res.status(201).json(newCase);
	} catch (error) {
		console.error("Error creating support case:", error);
		return res.status(400).json({ error: error.message });
	}
};

/**
 * Get all unassigned support cases (i.e. no supporterId)
 */
exports.getUnassignedSupportCases = async (req, res) => {
	try {
		const cases = await SupportCase.find({ supporterId: null });
		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get count of all unassigned support cases
 */
exports.getUnassignedSupportCasesCount = async (req, res) => {
	try {
		const count = await SupportCase.countDocuments({ supporterId: null });
		res.status(200).json({ count });
	} catch (error) {
		console.log(error);
		res.status(400).json({ error: error.message });
	}
};

// Define buildAgentFilter FIRST
function buildAgentFilter(user) {
	if (!user) return {};
	if (user.role === "SuperAdmin") return {};
	if (user.role === "Agent") {
		return { supporterId: user._id };
	}
	return { _id: { $exists: false } }; // block others
}

/**
 * Get open support cases (filter for those opened by super admin or agent)
 */
exports.getOpenSupportCases = async (req, res) => {
	try {
		const userFilter = buildAgentFilter(req.user);

		console.log(req.user, "req.user");

		// Merged final query: everything that was already in your code
		// plus the new filter for an agent.
		const query = {
			caseStatus: "open",
			openedBy: { $in: ["super admin", "agent"] },
			...userFilter, // This becomes supporterId = req.user._id if agent
		};

		const cases = await SupportCase.find(query)
			.populate("supporterId")
			.populate("propertyId");

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get open support cases for a specific property
 */
exports.getOpenSupportCasesForProperty = async (req, res) => {
	try {
		const { propertyId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(propertyId)) {
			return res.status(400).json({ error: "Invalid property ID" });
		}

		const cases = await SupportCase.find({
			caseStatus: "open",
			openedBy: { $in: ["super admin", "agent"] },
			propertyId: mongoose.Types.ObjectId(propertyId),
		})
			.populate("supporterId")
			.populate("propertyId");

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get open support cases opened by clients
 */
exports.getOpenSupportCasesClients = async (req, res) => {
	try {
		// 1) Pull userId from URL params (e.g. "/support-cases-clients/active/:userId")
		const { userId } = req.params;

		console.log("Received userId:", userId);

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ error: "Invalid user ID" });
		}

		// 2) Find the user doc in Mongo to get their role
		const user = await User.findById(userId).select("_id role");
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Prepare a base query for "open" + "openedBy: 'client'"
		let query = {
			caseStatus: "open",
			openedBy: "client",
		};

		// 3) Check user role
		if (user.role === 1000) {
			// role === 1000 => super admin
			// => They see ALL open cases by clients, so do nothing extra.
			// query stays as is: { caseStatus: "open", openedBy: "client" }
		} else if (user.role === 2000 || user.role === 3000 || user.role === 7000) {
			// role === 2000 => agent (or 3000/7000 if you treat them similarly)
			// => They see ONLY the cases whose propertyId belongs to them

			// A) Fetch all property IDs owned by this agent
			const propertyIds = await PropertyDetails.find({
				belongsTo: user._id,
			}).distinct("_id");

			// B) Narrow the query to only those property IDs
			// So we add a filter: "propertyId must be in that list"
			query.propertyId = { $in: propertyIds };
		} else {
			// 4) If it's any other role, decide what to do.
			// Option A: Return empty array
			return res.json([]);
			// Option B: return res.status(403).json({ error: "Not authorized" });
		}

		// 5) Finally, find the support cases with the final query
		const cases = await SupportCase.find(query)
			.populate("supporterId")
			.populate("propertyId");

		// 6) Return them
		res.status(200).json(cases);
	} catch (error) {
		console.error("Error fetching open support cases (B2C):", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get closed support cases (filter for those opened by super admin or agent)
 */
exports.getCloseSupportCases = async (req, res) => {
	try {
		const userFilter = buildAgentFilter(req.user);

		const query = {
			caseStatus: "closed",
			openedBy: { $in: ["super admin", "agent"] },
			...userFilter,
		};

		const cases = await SupportCase.find(query)
			.populate("supporterId")
			.populate("propertyId");

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get closed support cases for a specific property, opened by super admin or agent
 */
exports.getCloseSupportCasesForProperty = async (req, res) => {
	try {
		const { propertyId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(propertyId)) {
			return res.status(400).json({ error: "Invalid property ID" });
		}

		const cases = await SupportCase.find({
			caseStatus: "closed",
			openedBy: { $in: ["super admin", "agent"] },
			propertyId: mongoose.Types.ObjectId(propertyId),
		})
			.populate("supporterId")
			.populate("propertyId");

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get closed support cases for a specific property, opened by clients
 */
exports.getCloseSupportCasesForPropertyClients = async (req, res) => {
	try {
		const { propertyId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(propertyId)) {
			return res.status(400).json({ error: "Invalid property ID" });
		}

		const cases = await SupportCase.find({
			caseStatus: "closed",
			openedBy: "client",
			propertyId: mongoose.Types.ObjectId(propertyId),
		})
			.populate("supporterId")
			.populate("propertyId");

		res.status(200).json(cases);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Get closed support cases opened by clients (globally)
 */
exports.getCloseSupportCasesClients = async (req, res) => {
	try {
		// 1) Pull userId from URL params (e.g. "/support-cases-clients/closed/:userId")
		const { userId } = req.params;

		console.log("Received userId:", userId);

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ error: "Invalid user ID" });
		}

		// 2) Find the user doc in Mongo to get their role
		const user = await User.findById(userId).select("_id role");
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Prepare a base query for "closed" + "openedBy: 'client'"
		let query = {
			caseStatus: "closed",
			openedBy: "client",
		};

		// 3) Check user role
		if (user.role === 1000) {
			// SuperAdmin (role=1000) => sees ALL closed B2C
			// do nothing extra
		} else if (user.role === 2000 || user.role === 3000 || user.role === 7000) {
			// Agent => sees ONLY the cases whose propertyId belongs to them
			const propertyIds = await PropertyDetails.find({
				belongsTo: user._id,
			}).distinct("_id");

			query.propertyId = { $in: propertyIds };
		} else {
			// For other roles, return empty or 403
			return res.json([]);
		}

		// 5) Finally, find the support cases
		const cases = await SupportCase.find(query)
			.populate("supporterId")
			.populate("propertyId");

		// 6) Return them
		res.status(200).json(cases);
	} catch (error) {
		console.error("Error fetching closed support cases (B2C):", error);
		res.status(400).json({ error: error.message });
	}
};
/**
 * Count unseen messages by Admin (super admin),
 * excluding messages that the admin themselves sent.
 */
exports.getUnseenMessagesCountByAdmin = async (req, res) => {
	try {
		const { userId } = req.query;
		console.log("Received userId:", userId);

		// Count the unseen messages where messageBy.userId != current admin
		const count = await SupportCase.aggregate([
			{ $unwind: "$conversation" },
			{
				$match: {
					"conversation.seenByAdmin": false,
					"conversation.messageBy.userId": { $ne: userId },
				},
			},
			{ $count: "unseenCount" },
		]);

		const unseenCount = count.length > 0 ? count[0].unseenCount : 0;
		res.status(200).json({ count: unseenCount });
	} catch (error) {
		console.error("Error fetching unseen messages count:", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Fetch unseen messages count by Agent (property owner/listing agent)
 */
exports.getUnseenMessagesCountByAgent = async (req, res) => {
	try {
		const { propertyId } = req.params; // ID of the property the agent owns

		console.log("Received propertyId:", propertyId);

		if (!mongoose.Types.ObjectId.isValid(propertyId)) {
			return res.status(400).json({ error: "Invalid property ID" });
		}

		const count = await SupportCase.aggregate([
			{ $match: { propertyId: mongoose.Types.ObjectId(propertyId) } },
			{ $unwind: "$conversation" },
			{
				$match: {
					"conversation.seenByAgent": false,
				},
			},
			{ $count: "unseenCount" },
		]);

		const unseenCount = count.length > 0 ? count[0].unseenCount : 0;
		res.status(200).json({ count: unseenCount });
	} catch (error) {
		console.error("Error fetching unseen messages count for agent:", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Fetch unseen messages by a Regular Client
 */
exports.getUnseenMessagesByClient = async (req, res) => {
	try {
		const { clientId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(clientId)) {
			return res.status(400).json({ error: "Invalid client ID" });
		}

		// Example approach; tailor to your actual logic of "unseen by the client"
		const unseenMessages = await SupportCase.find({
			"conversation.messageBy.userId": mongoose.Types.ObjectId(clientId),
			caseStatus: { $ne: "closed" },
			"conversation.seenByClient": false,
		}).select(
			"conversation._id conversation.messageBy conversation.message conversation.date"
		);

		res.status(200).json(unseenMessages);
	} catch (error) {
		console.error("Error fetching unseen messages for client:", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Update seen status for Super Admin or Agent
 */
exports.updateSeenStatusForAdminOrAgent = async (req, res) => {
	try {
		const { id } = req.params; // SupportCase ID
		const role = req.user.role; // "SuperAdmin" or "Agent" etc.

		// Decide which field to update based on role
		const updateField =
			role === "SuperAdmin"
				? { "conversation.$[].seenByAdmin": true }
				: { "conversation.$[].seenByAgent": true };

		const result = await SupportCase.updateOne(
			{ _id: id },
			{ $set: updateField }
		);

		if (result.nModified === 0) {
			return res
				.status(404)
				.json({ error: "Support case not found or no unseen messages" });
		}

		res.status(200).json({ message: "Seen status updated" });
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Update seen status for Client
 */
exports.updateSeenStatusForClient = async (req, res) => {
	try {
		const { id } = req.params;

		const result = await SupportCase.updateOne(
			{ _id: id, "conversation.seenByClient": false },
			{ $set: { "conversation.$[].seenByClient": true } }
		);

		if (result.nModified === 0) {
			return res
				.status(404)
				.json({ error: "Support case not found or no unseen messages" });
		}

		res.status(200).json({ message: "Seen status updated for client" });
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

/**
 * Mark all messages as seen by Admin in a specific case
 */
exports.markAllMessagesAsSeenByAdmin = async (req, res) => {
	try {
		const { id } = req.params; // support case ID
		const { userId } = req.body; // the admin's userID

		// Update only messages that were not seen and not sent by the same admin
		const result = await SupportCase.updateOne(
			{ _id: ObjectId(id), "conversation.seenByAdmin": false },
			{ $set: { "conversation.$[elem].seenByAdmin": true } },
			{
				arrayFilters: [
					{
						"elem.messageBy.userId": { $ne: ObjectId(userId) },
						"elem.seenByAdmin": false,
					},
				],
			}
		);

		if (result.matchedCount === 0) {
			return res
				.status(404)
				.json({ error: "No unseen messages found or already updated" });
		}

		// Emit socket event if you have rooms set up
		req.app.get("io").to(id).emit("messageSeen", { caseId: id, userId });

		res.status(200).json({ message: "All messages marked as seen by Admin" });
	} catch (error) {
		console.error("Error:", error);
		res.status(400).json({ error: error.message });
	}
};

/**
 * Mark all messages as seen by Agent in a specific case
 */
exports.markAllMessagesAsSeenByAgent = async (req, res) => {
	try {
		const { id } = req.params;

		// Instead of arrayFilters, just update ALL conversation entries
		const result = await SupportCase.updateOne(
			{ _id: id },
			{
				$set: {
					// Mark messages as seen by both agent and admin
					"conversation.$[].seenByAgent": true,
					"conversation.$[].seenByAdmin": true,
				},
			}
		);

		if (result.matchedCount === 0) {
			return res
				.status(404)
				.json({ error: "Support case not found or already updated" });
		}

		return res.status(200).json({
			message: "All messages marked as seen by Agent and Admin",
		});
	} catch (error) {
		console.error("Error in markAllMessagesAsSeenByAgent:", error);
		return res.status(400).json({ error: error.message });
	}
};

/**
 * Mark every message in every case as seen by everyone
 */
exports.markEverythingAsSeen = async (req, res) => {
	try {
		const result = await SupportCase.updateMany(
			{},
			{
				$set: {
					"conversation.$[].seenByAdmin": true,
					"conversation.$[].seenByAgent": true,
					"conversation.$[].seenByClient": true,
				},
			}
		);

		res.status(200).json({
			message: "All messages in all cases marked as seen",
			updatedCases: result.modifiedCount,
		});
	} catch (error) {
		console.error("Error marking everything as seen:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * Delete a message from a conversation in a specific support case
 */
exports.deleteMessageFromConversation = async (req, res) => {
	try {
		const { caseId, messageId } = req.params;

		if (
			!mongoose.Types.ObjectId.isValid(caseId) ||
			!mongoose.Types.ObjectId.isValid(messageId)
		) {
			return res.status(400).json({ error: "Invalid case ID or message ID" });
		}

		const updatedCase = await SupportCase.findByIdAndUpdate(
			caseId,
			{
				$pull: { conversation: { _id: messageId } },
			},
			{ new: true }
		);

		if (!updatedCase) {
			return res
				.status(404)
				.json({ error: "Support case or message not found" });
		}

		// Emit socket event if needed
		req.io.to(caseId).emit("messageDeleted", { caseId, messageId });

		res
			.status(200)
			.json({ message: "Message deleted successfully", updatedCase });
	} catch (error) {
		console.error("Error deleting message:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * Admin: Get Active B2C
 *  => caseStatus="open", openedBy="client"
 */
exports.adminGetActiveB2C = async (req, res) => {
	try {
		// Must be superadmin
		if (!req.profile || req.profile.role !== 1000) {
			return res.status(403).json({ error: "Forbidden: Admin only." });
		}

		const cases = await SupportCase.find({
			openedBy: "client",
			caseStatus: "open",
		})
			.populate("supporterId")
			.populate("propertyId");

		return res.json(cases);
	} catch (err) {
		console.error("Error in adminGetActiveB2C:", err);
		return res.status(400).json({ error: err.message });
	}
};

/**
 * Admin: Get Closed B2C
 * => caseStatus="closed", openedBy="client"
 */
exports.adminGetClosedB2C = async (req, res) => {
	try {
		if (!req.profile || req.profile.role !== 1000) {
			return res.status(403).json({ error: "Forbidden: Admin only." });
		}

		const cases = await SupportCase.find({
			openedBy: "client",
			caseStatus: "closed",
		})
			.populate("supporterId")
			.populate("propertyId");

		return res.json(cases);
	} catch (err) {
		console.error("Error in adminGetClosedB2C:", err);
		return res.status(400).json({ error: err.message });
	}
};

/**
 * Admin: Get Active B2B
 * => caseStatus="open", openedBy in ["agent", "super admin"]
 */
exports.adminGetActiveB2B = async (req, res) => {
	try {
		if (!req.profile || req.profile.role !== 1000) {
			return res.status(403).json({ error: "Forbidden: Admin only." });
		}

		const cases = await SupportCase.find({
			openedBy: { $in: ["agent", "super admin"] },
			caseStatus: "open",
		})
			.populate("supporterId")
			.populate("propertyId");

		return res.json(cases);
	} catch (err) {
		console.error("Error in adminGetActiveB2B:", err);
		return res.status(400).json({ error: err.message });
	}
};

/**
 * Admin: Get Closed B2B
 * => caseStatus="closed", openedBy in ["agent", "super admin"]
 */
exports.adminGetClosedB2B = async (req, res) => {
	try {
		if (!req.profile || req.profile.role !== 1000) {
			return res.status(403).json({ error: "Forbidden: Admin only." });
		}

		const cases = await SupportCase.find({
			openedBy: { $in: ["agent", "super admin"] },
			caseStatus: "closed",
		})
			.populate("supporterId")
			.populate("propertyId");

		return res.json(cases);
	} catch (err) {
		console.error("Error in adminGetClosedB2B:", err);
		return res.status(400).json({ error: err.message });
	}
};
