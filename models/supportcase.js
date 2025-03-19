/**
 * SupportCase Model for Real Estate Support/Chat System
 *
 * This model tracks support cases between:
 *  - super admin (owner of the platform),
 *  - agent (property owner or listing agent),
 *  - and client (a regular user or lead).
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * A single conversation message within a support case.
 */
const conversationSchema = new Schema({
	messageBy: {
		// Basic info about who sent the message
		customerName: { type: String, required: true },
		customerEmail: { type: String, required: true },
		userId: { type: String }, // Could reference the user's ID in Users collection
	},
	message: {
		type: String,
		required: true,
	},
	date: {
		type: Date,
		default: Date.now,
	},
	inquiryAbout: {
		type: String,
		required: true, // e.g. "Question about listing #123"
	},
	inquiryDetails: {
		type: String,
		required: false, // Extended details if needed
	},
	seenByAdmin: {
		type: Boolean,
		default: false, // Whether super admin has seen the message
	},
	seenByAgent: {
		type: Boolean,
		default: false, // Whether the property agent/owner has seen the message
	},
	seenByClient: {
		type: Boolean,
		default: false, // Whether the client has seen the message
	},
});

/**
 * Main schema for a support case, containing conversation and metadata.
 */
const supportCaseSchema = new Schema({
	createdAt: {
		type: Date,
		default: Date.now,
	},
	rating: {
		// Possible rating for the support interaction
		type: Number,
		default: null,
	},
	closedBy: {
		// Who closed the case?
		type: String,
		enum: ["client", "agent", "super admin", null],
		default: null,
	},
	supporterId: {
		// The ID of a user who is assisting with this case
		type: Schema.Types.ObjectId,
		ref: "User",
	},
	supporterName: {
		// For convenience, store the name of the supporter
		type: String,
		default: "",
	},
	caseStatus: {
		// e.g. "open", "closed", etc.
		type: String,
		default: "open",
	},
	propertyId: {
		// Reference to the property associated with this case
		type: Schema.Types.ObjectId,
		ref: "PropertyDetails",
		required: false,
	},
	openedBy: {
		// Who started this support case: super admin, agent, or client
		type: String,
		enum: ["super admin", "agent", "client"],
		required: true,
	},
	// Array of messages exchanged
	conversation: [conversationSchema],
	displayName1: {
		// A label for the first participant (e.g. "Support Team" or "Agent John")
		type: String,
		required: true,
	},
	displayName2: {
		// A label for the second participant (e.g. "Client Jane")
		type: String,
		required: true,
	},
});

const SupportCase = mongoose.model("SupportCase", supportCaseSchema);

module.exports = SupportCase;
